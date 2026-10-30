/**
 * Plano ilustrado del barrio (viewBox 0–1000). Se superpone, georreferenciado a
 * BARRIO_BOUNDS, cuando las teselas del mapa no cargan (sin conexión).
 */
export const ILLUSTRATED_PLAN_SVG = `
<rect x="-200" y="-200" width="1400" height="1400" fill="#F3EFE6"/>
<path d="M-400,200 Q200,180 500,290 T1400,260 L1400,-400 L-400,-400 Z" fill="#EAE4D5" opacity="0.65" />
<path d="M-400,450 Q300,410 650,520 T1400,480 L1400,-400 L-400,-400 Z" fill="#E7E0D0" opacity="0.45" />
<path d="M120,80 C180,60 260,110 240,190 C220,260 140,280 90,230 C50,180 70,100 120,80 Z" fill="#DCE9DF" stroke="#CCDED0" stroke-width="2" />
<path d="M680,180 C780,150 860,210 840,320 C820,390 730,420 660,370 C600,320 620,220 680,180 Z" fill="#D8E6DB" stroke="#C6DACB" stroke-width="2" />
<path d="M380,590 C470,570 540,630 510,720 C480,800 390,820 330,760 C280,700 310,610 380,590 Z" fill="#E2EBE2" stroke="#D1DFD2" stroke-width="1.5" />
<path d="M720,730 C800,710 880,760 870,850 C850,910 770,950 710,910 C650,860 670,760 720,730 Z" fill="#DCE9DF" opacity="0.8" />
<path d="M760,820 C820,800 960,830 980,900 C990,960 900,990 820,960 C760,930 730,850 760,820 Z" fill="#D5E4F0" opacity="0.7" />
<g fill="#EAE5D9" stroke="#DDD6C7" stroke-width="1.5">
<polygon points="170,320 270,305 290,395 190,410" />
<polygon points="310,295 430,280 445,360 325,380" />
<polygon points="210,435 320,415 340,510 230,530" />
<polygon points="465,300 580,280 600,375 485,395" />
<polygon points="480,420 610,400 630,490 500,510" />
<polygon points="650,440 760,420 780,500 670,520" />
<polygon points="190,560 310,540 325,640 205,660" />
<polygon points="560,540 680,520 705,620 585,640" />
<polygon points="620,660 740,640 760,730 640,750" />
<polygon points="40,330 140,320 150,410 50,420" />
<polygon points="820,380 940,365 950,460 830,470" />
<polygon points="40,700 150,690 160,790 50,800" />
</g>
<g stroke="#FCFBF7" stroke-linecap="round" stroke-linejoin="round">
<line x1="-200" y1="285" x2="1200" y2="125" stroke-width="14" />
<line x1="-200" y1="500" x2="1200" y2="315" stroke-width="16" />
<line x1="-200" y1="720" x2="1200" y2="500" stroke-width="14" />
<line x1="215" y1="-50" x2="370" y2="1050" stroke-width="15" />
<line x1="430" y1="-50" x2="560" y2="1050" stroke-width="18" />
<line x1="670" y1="-50" x2="790" y2="1050" stroke-width="14" />
</g>
<path d="M-200,500 L1200,315" stroke="#EDE8DD" stroke-width="4" stroke-dasharray="8 6" />
<path d="M430,-50 L560,1050" stroke="#EDE8DD" stroke-width="4" stroke-dasharray="10 8" />
`;
