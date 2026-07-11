import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { tauriStoreStorage } from '@shared/services/storage/tauriStoreStorage';

export interface Product {
  id: string;
  companyId: string;
  categoryId?: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  price: number;
  stockQuantity: number;
  imageUrl?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

interface PosState {
  products: Product[];
  cart: CartItem[];
  isLoading: boolean;

  setProducts: (products: Product[]) => void;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
}

export const usePosStore = create<PosState>()(
  persist(
    (set) => ({
      products: [],
      cart: [],
      isLoading: false,

      setProducts: (products) => set({ products }),

      addToCart: (product) => set((state) => {
        const existing = state.cart.find((item) => item.id === product.id);
        if (existing) {
          return {
            cart: state.cart.map((item) =>
              item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
            ),
          };
        }
        return { cart: [...state.cart, { ...product, quantity: 1 }] };
      }),

      removeFromCart: (productId) => set((state) => ({
        cart: state.cart.filter((item) => item.id !== productId),
      })),

      updateQuantity: (productId, quantity) => set((state) => ({
        cart: state.cart.map((item) =>
          item.id === productId ? { ...item, quantity: Math.max(0, quantity) } : item
        ).filter(item => item.quantity > 0),
      })),

      clearCart: () => set({ cart: [] }),
    }),
    {
      name: 'smemaster-pos-cart',
      storage: tauriStoreStorage,
    }
  )
);
