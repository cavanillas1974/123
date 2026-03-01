import { useMemo, useState } from 'react';

type Service = {
  id: string;
  name: string;
  category: string;
  description: string;
  monthlyPrice: number;
  setupFee: number;
};

type SelectedService = Service & {
  quantity: number;
};

const CATALOG: Service[] = [
  {
    id: 'ai-assistant',
    name: 'Asistente IA 24/7',
    category: 'Automatización',
    description: 'Responde WhatsApp, Instagram y web en tiempo real.',
    monthlyPrice: 120,
    setupFee: 200
  },
  {
    id: 'ads-engine',
    name: 'Motor de Ads Autónomo',
    category: 'Marketing',
    description: 'Optimiza anuncios con señales de conversiones en vivo.',
    monthlyPrice: 180,
    setupFee: 300
  },
  {
    id: 'funnel-lab',
    name: 'Funnel Lab',
    category: 'CRO',
    description: 'Tests A/B y mejoras continuas del embudo comercial.',
    monthlyPrice: 140,
    setupFee: 250
  },
  {
    id: 'crm-sync',
    name: 'Sync CRM + Automatizaciones',
    category: 'Operaciones',
    description: 'Integra leads, seguimiento y tareas automáticas.',
    monthlyPrice: 160,
    setupFee: 280
  },
  {
    id: 'analytics-radar',
    name: 'Analytics Radar',
    category: 'Data',
    description: 'Dashboard ejecutivo con alertas de rendimiento.',
    monthlyPrice: 110,
    setupFee: 190
  },
  {
    id: 'creative-studio',
    name: 'Creative Studio IA',
    category: 'Contenido',
    description: 'Creatividades, copies y hooks adaptados a campañas.',
    monthlyPrice: 150,
    setupFee: 220
  }
];

const money = (amount: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);

export default function FuturisticServiceBuilder() {
  const [selected, setSelected] = useState<SelectedService[]>([]);

  const addService = (serviceId: string) => {
    const service = CATALOG.find((item) => item.id === serviceId);
    if (!service) return;

    setSelected((current) => {
      const existing = current.find((item) => item.id === serviceId);
      if (existing) {
        return current.map((item) =>
          item.id === serviceId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      return [...current, { ...service, quantity: 1 }];
    });
  };

  const removeService = (serviceId: string) => {
    setSelected((current) => current.filter((item) => item.id !== serviceId));
  };

  const updateQuantity = (serviceId: string, quantity: number) => {
    if (quantity < 1) return;
    setSelected((current) =>
      current.map((item) => (item.id === serviceId ? { ...item, quantity } : item))
    );
  };

  const totals = useMemo(() => {
    const subtotalMonthly = selected.reduce((sum, item) => sum + item.monthlyPrice * item.quantity, 0);
    const subtotalSetup = selected.reduce((sum, item) => sum + item.setupFee * item.quantity, 0);

    const bundleDiscount =
      selected.length >= 3
        ? Math.round(subtotalMonthly * 0.12)
        : selected.length >= 2
          ? Math.round(subtotalMonthly * 0.07)
          : 0;

    const totalMonthly = subtotalMonthly - bundleDiscount;
    const firstMonth = totalMonthly + subtotalSetup;

    return { subtotalMonthly, subtotalSetup, bundleDiscount, totalMonthly, firstMonth };
  }, [selected]);

  return (
    <section className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
      <article className="rounded-2xl border border-cyan-300/30 bg-slate-900/70 p-5 shadow-[0_0_40px_rgba(56,189,248,.12)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-cyan-100">Catálogo Modular</h2>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Arrastra y combina</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {CATALOG.map((service) => (
            <button
              key={service.id}
              draggable
              onDragStart={(event) => event.dataTransfer.setData('service-id', service.id)}
              onClick={() => addService(service.id)}
              className="group rounded-xl border border-white/10 bg-black/20 p-4 text-left transition hover:border-cyan-300/50 hover:bg-cyan-500/10"
            >
              <p className="text-xs uppercase tracking-wide text-cyan-200/70">{service.category}</p>
              <h3 className="mt-1 text-lg text-white">{service.name}</h3>
              <p className="mt-2 text-sm text-white/70">{service.description}</p>
              <p className="mt-3 text-sm font-semibold text-cyan-200">
                {money(service.monthlyPrice)}/mes + setup {money(service.setupFee)}
              </p>
              <span className="mt-3 inline-flex rounded-full border border-cyan-300/40 px-2 py-1 text-xs text-cyan-100">
                Click o drag para agregar
              </span>
            </button>
          ))}
        </div>
      </article>

      <article
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          const serviceId = event.dataTransfer.getData('service-id');
          addService(serviceId);
        }}
        className="rounded-2xl border border-fuchsia-300/30 bg-slate-900/80 p-5 shadow-[0_0_40px_rgba(232,121,249,.14)]"
      >
        <h2 className="text-2xl font-semibold text-fuchsia-100">Cotizador en tiempo real</h2>
        <p className="mb-4 text-sm text-fuchsia-100/70">Suelta aquí los servicios y arma tu stack ideal.</p>

        <div className="space-y-3">
          {selected.length === 0 && (
            <p className="rounded-lg border border-dashed border-fuchsia-300/40 p-4 text-sm text-white/70">
              Arrastra servicios desde el catálogo para comenzar tu cotización.
            </p>
          )}

          {selected.map((item) => (
            <div key={item.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{item.name}</p>
                  <p className="text-xs text-white/60">
                    {money(item.monthlyPrice)} / mes · setup {money(item.setupFee)}
                  </p>
                </div>

                <button
                  onClick={() => removeService(item.id)}
                  className="text-xs text-fuchsia-200/80 transition hover:text-fuchsia-100"
                >
                  Quitar
                </button>
              </div>

              <label className="mt-3 flex items-center gap-2 text-xs text-white/70">
                Cantidad
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(event) => updateQuantity(item.id, Number(event.target.value) || 1)}
                  className="w-20 rounded border border-white/20 bg-black/30 px-2 py-1 text-sm text-white"
                />
              </label>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-2 rounded-xl border border-fuchsia-200/20 bg-fuchsia-500/10 p-4 text-sm">
          <div className="flex justify-between text-white/80">
            <span>Subtotal mensual</span>
            <span>{money(totals.subtotalMonthly)}</span>
          </div>
          <div className="flex justify-between text-white/80">
            <span>Setup total</span>
            <span>{money(totals.subtotalSetup)}</span>
          </div>
          <div className="flex justify-between text-emerald-200">
            <span>Descuento bundle</span>
            <span>-{money(totals.bundleDiscount)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-white/20 pt-2 text-base font-semibold text-white">
            <span>Total mensual</span>
            <span>{money(totals.totalMonthly)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-cyan-100">
            <span>Primer mes estimado</span>
            <span>{money(totals.firstMonth)}</span>
          </div>
        </div>
      </article>
    </section>
  );
}
