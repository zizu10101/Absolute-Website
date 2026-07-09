import { ArrowRight, UploadCloud } from 'lucide-react';

export function UniformSubmissionPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-16">
        <span className="inline-block px-3 py-1 bg-red-50 text-[var(--primary-color)] font-headline font-bold text-xs tracking-widest uppercase mb-4">Kit Registry</span>
        <h1 className="text-6xl md:text-8xl font-headline font-bold tracking-tighter uppercase leading-[0.9] mb-6">Uniform<br/>Submission</h1>
        <p className="text-lg text-zinc-500 max-w-md font-medium leading-relaxed">
          Precision engineering starts with your specifications. Submit your team's requirements below to begin the elite customization process.
        </p>
      </div>

      <div className="mb-16">
        <div className="mb-8">
          <h2 className="font-headline font-bold text-3xl uppercase tracking-tight">Elite Uniform Designer</h2>
          <p className="text-zinc-500 font-medium">Use our professional designer tool to visualize your team's new look.</p>
        </div>
        <div className="w-full h-[900px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-zinc-200">
          <iframe 
            src="https://absolute-uniform-911558861648.us-west1.run.app/" 
            className="w-full h-full border-none"
            title="Elite Uniform Designer"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>

      <div className="mb-8">
        <h2 className="font-headline font-bold text-3xl uppercase tracking-tight">Manual Submission Form</h2>
        <p className="text-zinc-500 font-medium">Already have your designs? Submit your team's technical specifications directly.</p>
      </div>
      <div className="bg-white p-8 md:p-16 shadow-xl border border-zinc-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--primary-color)] -mr-16 -mt-16 rotate-45"></div>
        
        <form className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
          <div className="space-y-10">
            <div className="border-l-4 border-[var(--primary-color)] pl-6">
              <h2 className="font-headline font-bold text-2xl uppercase tracking-tight mb-8">Team Identity</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Team Name</label>
                  <input className="w-full bg-zinc-50 border-none p-4 font-headline font-bold uppercase" placeholder="e.g. VANGUARD FC" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Contact Person</label>
                  <input className="w-full bg-zinc-50 border-none p-4 font-medium" placeholder="Full Legal Name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Email</label>
                    <input className="w-full bg-zinc-50 border-none p-4 font-medium" placeholder="official@team.com" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Phone</label>
                    <input className="w-full bg-zinc-50 border-none p-4 font-medium" placeholder="+1 (000) 000-0000" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-10">
            <div className="border-l-4 border-zinc-200 pl-6">
              <h2 className="font-headline font-bold text-2xl uppercase tracking-tight mb-8">Technical Specs</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Number of Players</label>
                  <input className="w-full bg-zinc-50 border-none p-4 font-bold" type="number" placeholder="Total Roster Count" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Style Preference</label>
                  <select className="w-full bg-zinc-50 border-none p-4 font-headline font-bold uppercase">
                    <option>Select Style</option>
                    <option>Pro-Fit Kinetic</option>
                    <option>Elite Aero</option>
                    <option>Custom Build</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Logo Upload</label>
                  <div className="w-full aspect-[4/1] bg-zinc-50 border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-100 transition-colors">
                    <UploadCloud className="text-zinc-400 mb-1" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Drop Vector Files Here</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 pt-8">
            <button className="w-full bg-[var(--primary-color)] text-white py-6 font-headline font-black text-2xl uppercase tracking-widest hover:bg-zinc-900 transition-colors flex items-center justify-center gap-4">
              Complete Submission
              <ArrowRight />
            </button>
            <p className="text-[10px] text-center mt-6 text-zinc-400 uppercase font-bold tracking-[0.2em]">
              By submitting, you agree to our elite performance standards and production timelines.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
