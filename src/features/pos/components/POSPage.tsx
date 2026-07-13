import React, { useState, useEffect } from 'react';
import {
  ShoppingCart, Package, Search, Trash2, CreditCard, Banknote,
  Printer, AlertCircle, RefreshCw,
} from 'lucide-react';
import { usePosStore, type Product } from '../stores/posStore';
import { useHardwareStore } from '../stores/hardwareStore';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useToastStore } from '@shared/stores/toastStore';
import { useAccountStore } from '@features/accounts/stores/accountStore';
import { SkeletonPage } from '@shared/components/ui/Skeleton';
import {
  listProducts, searchProducts, recordSale, openCashDrawer, printReceipt,
} from '@shared/services/db/invoke/pos';

export const POSPage: React.FC = () => {
  const { cart, products, setProducts, addToCart, updateQuantity, clearCart } = usePosStore();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeAccountId = useAccountStore((s) => s.activeAccountId) ?? 'default';

  // Load products from backend
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await listProducts(activeAccountId);
        if (!cancelled) {
          setProducts(result as unknown as Product[]);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load products');
          setLoading(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [activeAccountId, setProducts]);

  // Barcode scanner — search via backend
  useBarcodeScanner(async (barcode) => {
    try {
      const results = await searchProducts(activeAccountId, barcode);
      if (results.length > 0) {
        addToCart(results[0] as unknown as Product);
      }
    } catch {
      // silent fail for scanner
    }
  });

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const toast = useToastStore((s) => s.addToast);

  const handleOpenCashDrawer = async () => {
    try {
      const { configs } = useHardwareStore.getState();
      const printer = configs.find(c => c.deviceType === 'printer' && c.isDefault)
        || configs.find(c => c.deviceType === 'printer');
      if (!printer) { toast({ message: 'No printer configured', type: 'error', duration: 4000 }); return; }
      await openCashDrawer(printer);
      toast({ message: 'Cash drawer opened!', type: 'success', duration: 3000 });
    } catch (err) {
      toast({ message: `Failed to open cash drawer: ${err}`, type: 'error', duration: 5000 });
    }
  };

  const handlePayment = async (method: string) => {
    if (cart.length === 0) {
      toast({ message: 'Cart is empty — add items before paying', type: 'info', duration: 3000 });
      return;
    }
    try {
      // Record the sale in the backend
      await recordSale(
        activeAccountId,
        cart.map(item => ({
          productId: item.id,
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          taxRate: 0,
        })),
        total,
        method,
      );

      // Print receipt if printer is configured
      const { configs } = useHardwareStore.getState();
      const defaultPrinter = configs.find(c => c.deviceType === 'printer' && c.isDefault)
        || configs.find(c => c.deviceType === 'printer');

      if (defaultPrinter) {
        await printReceipt(defaultPrinter, `<h1>Receipt</h1><p>Total: $${total.toFixed(2)}</p><p>Method: ${method}</p>`);
      }

      toast({ message: `Payment successful via ${method}!`, type: 'success', duration: 4000 });
      clearCart();
    } catch (err) {
      toast({ message: `Payment failed: ${err}`, type: 'error', duration: 5000 });
    }
  };

  // Filter products locally by search
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.includes(search))
  );

  // Loading state
  if (loading) {
    return <SkeletonPage />;
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <AlertCircle size={36} className="text-danger" />
        <div>
          <p className="text-sm font-semibold text-text-primary">Failed to load POS products</p>
          <p className="text-xs text-text-tertiary mt-1">{error}</p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            setError(null);
            listProducts(activeAccountId)
              .then((result) => {
                setProducts(result as unknown as Product[]);
                setLoading(false);
              })
              .catch((err) => {
                setError(err instanceof Error ? err.message : 'Failed to load products');
                setLoading(false);
              });
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
        >
          <RefreshCw size={13} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      {/* Products Section */}
      <div className="flex-1 flex flex-col p-6 space-y-6 overflow-hidden">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-text-primary">Point of Sale</h1>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
              <input
                type="text"
                placeholder="Search products..."
                aria-label="Search products"
                className="w-full pl-10 pr-4 py-2 border border-border-primary rounded-xl bg-bg-secondary/60 text-text-primary placeholder:text-text-tertiary glass-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={handleOpenCashDrawer}
              title="Open Cash Drawer"
              aria-label="Open cash drawer"
              className="p-2 border border-border-primary rounded-xl hover:bg-bg-hover/60 transition-colors text-text-tertiary hover:text-text-secondary"
            >
              <Printer size={18} />
            </button>
          </div>
        </div>

        <div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pr-2"
          role="list"
          aria-label="Products"
        >
          {filteredProducts.length > 0 ? filteredProducts.map((product) => (
            <button
              key={product.id}
              role="listitem"
              onClick={() => addToCart(product)}
              aria-label={`Add ${product.name} to cart`}
              className="p-4 border border-border-primary rounded-xl bg-bg-secondary/60 hover:border-accent hover:bg-bg-hover/60 transition-colors text-left space-y-2"
            >
              <div className="w-full aspect-square bg-accent/10 rounded-xl flex items-center justify-center">
                <Package className="text-text-tertiary" size={32} />
              </div>
              <h3 className="font-semibold truncate text-text-primary">{product.name}</h3>
              <p className="text-accent font-bold">${product.price.toFixed(2)}</p>
              <p className="text-xs text-text-tertiary">Stock: {product.stockQuantity}</p>
            </button>
          )) : (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center text-text-tertiary">
              <Package size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">{search ? 'No products match your search' : 'No products available'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-96 border-l border-border-primary bg-bg-secondary/60 flex flex-col" role="region" aria-label="Shopping cart">
        <div className="p-6 border-b border-border-primary flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-text-primary" />
            <h2 className="text-xl font-bold text-text-primary">Your Cart</h2>
          </div>
          <button onClick={clearCart} aria-label="Clear cart" className="text-text-tertiary hover:text-danger">
            <Trash2 size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.map((item) => (
            <div key={item.id} className="flex justify-between items-center gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate text-text-primary">{item.name}</h4>
                <p className="text-sm text-text-tertiary">${item.price.toFixed(2)} x {item.quantity}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  aria-label={`Decrease quantity of ${item.name}`}
                  className="w-8 h-8 border border-border-primary rounded-md flex items-center justify-center text-text-secondary hover:bg-bg-hover/60"
                >
                  -
                </button>
                <span className="w-4 text-center text-text-primary tabular-nums">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  aria-label={`Increase quantity of ${item.name}`}
                  className="w-8 h-8 border border-border-primary rounded-md flex items-center justify-center text-text-secondary hover:bg-bg-hover/60"
                >
                  +
                </button>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="text-center py-12 text-text-tertiary text-sm">
              <ShoppingCart size={24} className="mx-auto mb-2 opacity-40" />
              Cart is empty
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border-primary bg-accent/5 space-y-4">
          <div className="flex justify-between text-lg font-bold">
            <span className="text-text-primary">Total</span>
            <span className="text-accent">${total.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handlePayment('card')}
              aria-label="Pay with card"
              className="flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
            >
              <CreditCard size={18} /> Card
            </button>
            <button
              onClick={() => handlePayment('cash')}
              aria-label="Pay with cash"
              className="flex items-center justify-center gap-2 bg-success text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
            >
              <Banknote size={18} /> Cash
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
