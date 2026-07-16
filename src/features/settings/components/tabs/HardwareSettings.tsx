import React, { useState } from 'react';
import { Plus, Trash2, Printer } from 'lucide-react';
import { useHardwareStore, HardwareConfig, DeviceType, ConnectionType } from '@features/pos/stores/hardwareStore';
import { invokeCommand } from '@shared/services/db/invoke/command';
import { notify } from '@shared/services/notifications/toastHelper';
import { HelpCard } from '@features/settings/components/HelpCard';

export const HardwareSettings: React.FC = () => {
  const { configs, addConfig, removeConfig } = useHardwareStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newConfig, setNewConfig] = useState<Partial<HardwareConfig>>({
    name: '',
    deviceType: 'printer',
    connectionType: 'network',
    connectionParams: {},
  });

  const handleAdd = () => {
    const params: Record<string, string> = {};
    if (newConfig.connectionType === 'network') {
      params.ip = '192.168.1.100'; // Default or from input
      params.port = '9100';
    } else if (newConfig.connectionType === 'system') {
      params.printerName = 'System Printer';
    }

    const config: HardwareConfig = {
      id: crypto.randomUUID(),
      companyId: 'default',
      name: newConfig.name || 'New Device',
      deviceType: (newConfig.deviceType as DeviceType) || 'printer',
      driverType: 'escpos',
      connectionType: (newConfig.connectionType as ConnectionType) || 'network',
      connectionParams: params,
      isDefault: configs.length === 0,
    };
    addConfig(config);
    setIsAdding(false);
  };

  const testDevice = async (config: HardwareConfig) => {
    try {
      await invokeCommand('pos_test_printer', { config });
      notify('Printer', 'Test print sent!');
    } catch (err) {
      notify('Printer', `Test failed: ${err}`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Hardware Configuration</h2>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-md"
        >
          <Plus size={18} /> Add Device
        </button>
      </div>

      {/* Education: Hardware Configuration */}
      <HelpCard
        items={[
          { type: "why", text: "Hardware devices like receipt printers, barcode scanners, and cash drawers are essential for POS and invoicing workflows in retail and hospitality environments." },
          { type: "how", text: "Each device is configured by type (printer, scanner, scale, cash drawer) and connection method (network, USB, system driver, or serial). Test each device after adding to verify connectivity." },
          { type: "when", text: "Configure hardware when setting up POS capabilities. Add printers for receipt/invoice printing, scanners for barcode entry, and scales for weighted items." },
          { type: "tip", text: "Network printers (TCP/IP) are recommended for reliability. USB connections work well for single-workstation setups. Test each device after adding to verify connectivity." },
        ]}
      />

      <div className="grid gap-4">
        {configs.map((config) => (
          <div key={config.id} className="border rounded-lg p-4 flex justify-between items-center bg-card">
            <div>
              <h3 className="font-semibold text-lg">{config.name}</h3>
              <p className="text-sm text-muted-foreground capitalize">
                {config.deviceType} • {config.connectionType}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => testDevice(config)}
                className="p-2 hover:bg-accent rounded-md"
                title="Test Device"
              >
                <Printer size={18} />
              </button>
              <button
                onClick={() => removeConfig(config.id)}
                className="p-2 hover:bg-destructive/10 text-destructive rounded-md"
                title="Remove"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}

        {configs.length === 0 && !isAdding && (
          <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
            No hardware configured.
          </div>
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background border rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-xl font-bold">Add New Hardware</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Device Name</label>
              <input
                type="text"
                className="w-full border rounded-md p-2 bg-background"
                value={newConfig.name}
                onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                placeholder="Kitchen Printer"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Device Type</label>
              <select
                className="w-full border rounded-md p-2 bg-background"
                value={newConfig.deviceType}
                onChange={(e) => setNewConfig({ ...newConfig, deviceType: e.target.value as DeviceType })}
              >
                <option value="printer">Receipt Printer</option>
                <option value="scanner">Barcode Scanner</option>
                <option value="scale">Electronic Scale</option>
                <option value="cash_drawer">Cash Drawer</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Connection Type</label>
              <select
                className="w-full border rounded-md p-2 bg-background"
                value={newConfig.connectionType}
                onChange={(e) => setNewConfig({ ...newConfig, connectionType: e.target.value as ConnectionType })}
              >
                <option value="network">Network (TCP/IP)</option>
                <option value="usb">USB</option>
                <option value="system">System Driver</option>
                <option value="serial">Serial (RS232)</option>
              </select>
            </div>
            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setIsAdding(false)}
                className="flex-1 border rounded-md py-2 hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 bg-primary text-white rounded-md py-2"
              >
                Save Device
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
