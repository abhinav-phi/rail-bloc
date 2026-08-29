import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#ffffff] font-sans overflow-x-hidden selection:bg-[#bc7155] selection:text-[#ffffff]">
      <style>{`
        @keyframes speed-line {
          0% { transform: translateX(0); opacity: 0; }
          10% { opacity: 0.15; }
          90% { opacity: 0.15; }
          100% { transform: translateX(-120vw); opacity: 0; }
        }
      `}</style>

      {/* HERO SECTION */}
      <section className="relative min-h-[90vh] flex flex-col justify-between bg-gradient-to-b from-[#e0f0ff] to-[#fcfbf9] px-[22px] py-[80px] overflow-hidden">
        {/* Navigation / Header (Minimal) */}
        <nav className="w-full max-w-[1200px] mx-auto flex justify-end">
          <Link 
            href="/login" 
            className="text-[#000d10] text-[20px] leading-[20px] font-normal hover:opacity-70 transition-opacity"
          >
            Sign In
          </Link>
        </nav>

        {/* Dynamic Train Animation Background */}
        <div 
          className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] md:w-[800px] h-[250px] pointer-events-none z-0 opacity-50"
          style={{
            maskImage: 'linear-gradient(to right, transparent, black 20%, black 80%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 20%, black 80%, transparent)'
          }}
        >
           {/* Speed Lines */}
           <div className="absolute inset-0 w-full h-full">
              {[
                { top: 12, width: 140, height: 1, duration: 1.5, delay: 0.2 },
                { top: 25, width: 200, height: 2, duration: 2.1, delay: 0.5 },
                { top: 40, width: 100, height: 1, duration: 1.8, delay: 1.2 },
                { top: 50, width: 180, height: 2, duration: 2.5, delay: 0.1 },
                { top: 62, width: 120, height: 1, duration: 1.2, delay: 0.8 },
                { top: 75, width: 220, height: 2, duration: 1.9, delay: 1.5 },
                { top: 88, width: 90, height: 1, duration: 2.2, delay: 0.4 },
                { top: 15, width: 170, height: 2, duration: 1.6, delay: 1.8 },
                { top: 35, width: 130, height: 1, duration: 2.4, delay: 0.3 },
                { top: 55, width: 250, height: 2, duration: 1.4, delay: 1.1 },
                { top: 70, width: 110, height: 1, duration: 2.0, delay: 0.9 },
                { top: 80, width: 160, height: 2, duration: 1.7, delay: 1.6 },
                { top: 95, width: 140, height: 1, duration: 2.3, delay: 0.7 },
                { top: 5, width: 190, height: 2, duration: 1.3, delay: 1.4 },
                { top: 45, width: 105, height: 1, duration: 2.6, delay: 0.6 },
              ].map((line, i) => (
                 <div
                   key={i}
                   className="absolute bg-[#8e8e95]"
                   style={{
                     top: `${line.top}%`,
                     left: '100%',
                     width: `${line.width}px`,
                     height: `${line.height}px`,
                     opacity: 0,
                     animation: `speed-line ${line.duration}s linear ${line.delay}s infinite`
                   }}
                 />
              ))}
           </div>
           
           {/* Floating Train */}
           <div className="relative w-full h-full flex items-center justify-center animate-float">
             <svg viewBox="0 0 1000 300" className="w-full h-full drop-shadow-none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="train-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0"/>
                    <stop offset="40%" stopColor="#ffffff" stopOpacity="1"/>
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="1"/>
                  </linearGradient>
                </defs>
                
                {/* Main Body */}
                <path 
                  d="M-200,220 L750,220 C850,220 950,200 950,160 C950,110 800,90 700,90 L-200,90 Z" 
                  fill="url(#train-grad)" 
                />
                
                {/* Accent Stripe (Lighter for less contrast) */}
                <path 
                  d="M-200,170 L800,170 C880,170 920,175 940,180 C910,190 850,195 750,195 L-200,195 Z" 
                  fill="#d5d3d4" 
                />

                {/* Cockpit Window */}
                <path 
                  d="M680,100 L760,100 C820,100 860,115 880,135 L830,135 C800,120 750,115 680,115 Z" 
                  fill="#d5d3d4" 
                />

                {/* Passenger Windows */}
                {[...Array(8)].map((_, i) => (
                  <rect key={i} x={150 + i * 60} y="115" width="40" height="20" rx="6" fill="#d5d3d4" />
                ))}
              </svg>
           </div>
        </div>

        {/* Hero Content */}
        <div className="flex-grow flex flex-col md:flex-row justify-between items-end pb-[80px] w-full max-w-[1200px] mx-auto relative z-10">
          
          {/* Flush Left Wordmark */}
          <h1 className="text-[#000d10] font-bold text-[80px] leading-[0.8] tracking-[-1.26px] md:text-[131px] md:leading-[131px] md:tracking-[-2.62px] m-0 p-0 self-end">
            RAIL-BLOC<sup className="text-[30px] md:text-[40px] align-super tracking-normal font-normal">®</sup>
          </h1>

          {/* Right Aligned Headline & CTA */}
          <div className="flex flex-col items-end text-right mt-16 md:mt-0 max-w-[500px]">
            <h2 className="text-[#000d10] font-bold text-[40px] leading-[1] tracking-[-0.52px] md:text-[63px] md:leading-[63px] md:tracking-[-1.26px] mb-[38px]">
              Beyond Planning.
            </h2>
            <Link 
              href="/dashboard"
              className="inline-flex items-center justify-center bg-[#000d10] text-[#ffffff] rounded-full px-[22px] pt-[15px] pb-[16px] text-[17px] font-bold hover:opacity-90 transition-opacity"
            >
              Launch Console
            </Link>
          </div>
          
        </div>
      </section>

      {/* FEATURED CLAY CARD (ONLY ONE) */}
      <section className="w-full bg-[#ffffff] px-[22px] pt-[80px] pb-[40px] flex justify-center">
        <div className="max-w-[1200px] w-full">
          <div className="bg-[#bc7155] rounded-none px-[59px] py-[53px] w-full md:w-[80%] lg:w-[60%] text-[#ffffff]">
            <h3 className="text-[30px] md:text-[37px] leading-[1] tracking-[-0.37px] font-bold mb-[22px]">
              CP-SAT Multi-Horizon Solver
            </h3>
            <p className="text-[18px] leading-[29px] font-normal">
              Google OR-Tools constraint programming solver with interval-based scheduling. 
              Produces mathematically bounded block plans across strategic 26-week, tactical weekly, 
              and real-time operational horizons — warm-started from baseline configuration.
            </p>
          </div>
        </div>
      </section>

      {/* STANDARD FEATURE BLOCKS */}
      <section className="w-full bg-[#ffffff] px-[22px] pt-[40px] pb-[80px] flex justify-center">
        <div className="max-w-[1200px] w-full flex flex-col items-end">
            {/* Right-aligned content column at ~75% width */}
            <div className="w-full md:w-[85%] lg:w-[75%]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-[80px]">
                {/* Feature 1 */}
                <div className="border-t border-[#d5d3d4] pt-[22px]">
                  <h4 className="text-[#000d10] text-[23px] font-bold tracking-[-0.23px] leading-[23px] mb-[16px]">
                    Multi-Department Bundling
                  </h4>
                  <p className="text-[#8e8e95] text-[18px] leading-[29px] font-normal">
                    Unifies Civil, Traction, and Signal maintenance demands into co-allocated 
                    shadow blocks. Eliminates redundant line closures and maximizes asset uptime 
                    through window-containment spatial overlap detection.
                  </p>
                </div>
                
                {/* Feature 2 */}
                <div className="border-t border-[#d5d3d4] pt-[22px]">
                  <h4 className="text-[#000d10] text-[23px] font-bold tracking-[-0.23px] leading-[23px] mb-[16px]">
                    Fail-Closed Sentinel Verifications
                  </h4>
                  <p className="text-[#8e8e95] text-[18px] leading-[29px] font-normal">
                    10-point deterministic G&SR + MILP verification. Fail-closed architecture — 
                    no plan reaches human operators without passing every safety check, bound to 
                    its exact content hash.
                  </p>
                </div>
              </div>
            </div>
        </div>
      </section>

      {/* DARK CONTENT SECTION */}
      <section className="w-full bg-[#0f0f1c] px-[22px] py-[119px] flex justify-center">
        <div className="max-w-[1200px] w-full flex flex-col items-end">
            {/* Right-aligned content column at ~50% width */}
            <div className="w-full md:w-[60%] lg:w-[50%] flex flex-col items-end text-right">
              <h3 className="text-[#ffffff] text-[30px] md:text-[37px] leading-[1] font-bold tracking-[-0.37px] mb-[31px]">
                Tamper-Evident Audit Ledger
              </h3>
              <p className="text-[#ffffff] text-[18px] leading-[29px] font-normal">
                SHA-256 hash-chained, append-only relational audit trail. 
                Tamper-evident logging of every approval, override, and state change 
                with advisory-locked integrity. Built for absolute accountability.
              </p>
            </div>
        </div>
      </section>
      
      {/* FOOTER TERMINAL */}
      <footer className="w-full bg-[#000d10] px-[22px] py-[80px] flex justify-center">
        <div className="max-w-[1200px] w-full flex flex-col md:flex-row justify-between items-start md:items-end gap-[38px]">
          <h2 className="text-[#ffffff] font-bold text-[37px] md:text-[52px] leading-[1] tracking-[-0.52px] m-0">
            RAIL-BLOC<sup className="text-[20px] align-super tracking-normal font-normal">®</sup>
          </h2>
          <div className="flex gap-[38px]">
             <Link href="/dashboard" className="text-[#8e8e95] text-[20px] leading-[20px] hover:text-[#ffffff] transition-colors">
                Launch Console
             </Link>
          </div>
        </div>
      </footer>
      
    </div>
  );
}
