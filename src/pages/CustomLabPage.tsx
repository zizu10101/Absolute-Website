import { Helmet } from 'react-helmet-async';

export function CustomLabPage() {
  return (
    <>
      <Helmet>
        <title>Custom Lab - Design Your Jersey | Absolute Soccer Mississauga</title>
        <meta
          name="description"
          content="Design your custom soccer jersey online. Add logos, numbers, names and colors. Absolute Soccer Mississauga custom uniform designer."
        />
        <link rel="canonical" href="https://torontosoccershop.com/custom-lab" />
      </Helmet>

      <div className="bg-[#050508] text-white flex flex-col">
        {/* Lab Interface */}
        <main className="relative h-[calc(100vh-73px)] md:h-[calc(100vh-113px)]">
          <iframe
            src="https://absolute-basic-jersey-customizer-930161668914.us-west1.run.app"
            className="w-full h-full border-none"
            title="Custom Jersey Designer"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </main>

        {/* Footer Info */}
        <footer className="p-4 bg-[#050508] border-t border-white/5 text-center">
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.3em]">
            Absolute Soccer Elite Customization Engine v2.4
          </p>
        </footer>
      </div>
    </>
  );
}
