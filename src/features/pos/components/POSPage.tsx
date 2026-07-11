import React, { useState } from 'react';
import { ShoppingCart, Package, Search, Trash2, CreditCard, Banknote } from 'lucide-react';
import { usePosStore, Product } from '../stores/posStore';
import { useHardwareStore } from '../stores/hardwareStore';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { invoke } from '@tauri-apps/api/core';

const MOCK_PRODUCTS: Product[] = [
  { id: '1', companyId: 'default', name: 'Coffee beans', price: 15.00, stockQuantity: 50, barcode: '123456' },
  { id: '2', companyId: 'default', name: 'Milk 1L', price: 3.50, stockQuantity: 20, barcode: '789012' },
  { id: '3', companyId: 'default', name: 'Croissant', price: 4.20, stockQuantity: 15, barcode: '345678' },
];

export const POSPage: React.FC = () => {
  const { cart, products, setProducts, addToCart, updateQuantity, clearCart } = usePosStore();
  const [search, setSearch] = useState('');

  React.useEffect(() => {
    // If store is empty, seed it with mock data
    if (products.length === 0) {
      setProducts(MOCK_PRODUCTS);
    }
  }, [products, setProducts]);

  useBarcodeScanner((barcode) => {
    const product = MOCK_PRODUCTS.find(p => p.barcode === barcode);
    if (product) {
      addToCart(product);
    }
  });

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handlePayment = async (method: string) => {
    if (cart.length === 0) return;
    try {
      const { configs } = useHardwareStore.getState();
      const defaultPrinter = configs.find(c => c.deviceType === 'printer' && c.isDefault) || configs.find(c => c.deviceType === 'printer');

      if (defaultPrinter) {
        await invoke('pos_print_receipt', {
          config: defaultPrinter,
          htmlContent: `<h1>Receipt</h1><p>Total: $${total.toFixed(2)}</p><p>Method: ${method}</p>`
        });
      }

      alert(`Payment successful via ${method}!`);
      clearCart();
    } catch (err) {
      alert(`Payment failed: ${err}`);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.includes(search)
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Products Section */}
      <div className="flex-1 flex flex-col p-6 space-y-6 overflow-hidden">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Point of Sale</h1>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pr-2">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="p-4 border rounded-xl bg-card hover:border-primary transition-colors text-left space-y-2"
            >
              <div className="w-full aspect-square bg-accent rounded-lg flex items-center justify-center">
                <Package className="text-muted-foreground" size={32} />
              </div>
              <h3 className="font-semibold truncate">{product.name}</h3>
              <p className="text-primary font-bold">${product.price.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Stock: {product.stockQuantity}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-96 border-l bg-card flex flex-col">
        <div className="p-6 border-b flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} />
            <h2 className="text-xl font-bold">Your Cart</h2>
          </div>
          <button onClick={clearCart} className="text-muted-foreground hover:text-destructive">
            <Trash2 size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.map((item) => (
            <div key={item.id} className="flex justify-between items-center gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate">{item.name}</h4>
                <p className="text-sm text-muted-foreground">${item.price.toFixed(2)} x {item.quantity}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="w-8 h-8 border rounded-md flex items-center justify-center hover:bg-accent"
                >
                  -
                </button>
                <span className="w-4 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="w-8 h-8 border rounded-md flex items-center justify-center hover:bg-accent"
                >
                  +
                </button>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Cart is empty
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-accent/20 space-y-4">
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handlePayment('card')}
              className="flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold hover:opacity-90"
            >
              <CreditCard size={18} /> Card
            </button>
            <button
              onClick={() => handlePayment('cash')}
              className="flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-bold hover:opacity-90"
            >
              <Banknote size={18} /> Cash
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
