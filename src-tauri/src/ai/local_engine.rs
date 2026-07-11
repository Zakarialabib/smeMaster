use anyhow::Result;
use candle_core::{Device, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::bert::{BertModel, Config, DTYPE};
use tokenizers::Tokenizer;
use std::path::PathBuf;

pub struct LocalEngine {
    device: Device,
    model: Option<(BertModel, Tokenizer)>,
}

impl LocalEngine {
    pub fn new() -> Result<Self> {
        let device = Device::cuda_if_available(0)
            .unwrap_or_else(|_| Device::new_metal(0).unwrap_or(Device::Cpu));
        Ok(Self { device, model: None })
    }

    pub fn load_model(&mut self, model_path: PathBuf, tokenizer_path: PathBuf) -> Result<()> {
        let config = Config::default();
        let tokenizer = Tokenizer::from_file(tokenizer_path).map_err(anyhow::Error::msg)?;
        let vb = unsafe { VarBuilder::from_mmaped_safetensors(&[model_path], DTYPE, &self.device)? };
        let model = BertModel::load(vb, &config)?;
        self.model = Some((model, tokenizer));
        Ok(())
    }

    pub async fn get_embeddings(&self, text: &str) -> Result<Vec<f32>> {
        let (model, tokenizer) = self.model.as_ref().ok_or_else(|| anyhow::anyhow!("Model not loaded"))?;

        let tokens = tokenizer.encode(text, true).map_err(anyhow::Error::msg)?;
        let token_ids = tokens.get_ids().to_vec();
        let input_ids = Tensor::new(&token_ids[..], &self.device)?.unsqueeze(0)?;
        let token_type_ids = Tensor::new(&vec![0u32; token_ids.len()][..], &self.device)?.unsqueeze(0)?;

        let embeddings = model.forward(&input_ids, &token_type_ids, None)?;

        // Mean pooling
        let (_n_batch, n_tokens, _hidden_size) = embeddings.dims3()?;
        let embeddings = (embeddings.sum(1)? / (n_tokens as f64))?;
        let embeddings = embeddings.get(0)?;

        // Normalize
        let norm = embeddings.sqr()?.sum_all()?.sqrt()?;
        let embeddings = (embeddings / norm)?;

        Ok(embeddings.to_vec1::<f32>()?)
    }
}
