export function SigninProductArt() {
  return (
    <svg
      viewBox="0 0 760 560"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* soft background shapes */}
      <circle cx="145" cy="505" r="115" fill="#E1F2E5" />
      <circle cx="285" cy="530" r="90" fill="#D7EFDC" />
      <circle cx="705" cy="490" r="130" fill="#DDF2E2" />

      {/* Repository cube */}
      <g transform="translate(95 225)">
        <path
          d="M0 55 100 5l100 50-100 52Z"
          fill="#FFFCF3"
          stroke="#234E58"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path
          d="M0 55v140l100 55V107Z"
          fill="#FFFDF6"
          stroke="#234E58"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path
          d="M100 107v143l100-55V55Z"
          fill="#FFFDF6"
          stroke="#234E58"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <circle cx="59" cy="153" r="28" fill="#111827" />
        <path
          d="M46 153c0-9 6-16 14-16s14 7 14 16c0 7-4 12-9 14l2 8-7-5-7 5 2-8c-5-2-9-7-9-14Z"
          fill="#fff"
        />
        <line x1="125" y1="135" x2="170" y2="114" stroke="#E8A389" strokeWidth="6" strokeLinecap="round" />
        <line x1="125" y1="153" x2="160" y2="136" stroke="#71939A" strokeWidth="5" strokeLinecap="round" />
        <line x1="125" y1="171" x2="175" y2="147" stroke="#71939A" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* Main graph */}
      <g transform="translate(380 306)">
        <circle cx="0" cy="0" r="88" fill="#FFFDF7" stroke="#234E58" strokeWidth="5" />
        <line x1="-40" y1="5" x2="0" y2="-40" stroke="#234E58" strokeWidth="5" />
        <line x1="0" y1="-40" x2="44" y2="5" stroke="#234E58" strokeWidth="5" />
        <line x1="44" y1="5" x2="0" y2="47" stroke="#234E58" strokeWidth="5" />
        <line x1="0" y1="47" x2="-40" y2="5" stroke="#234E58" strokeWidth="5" />
        <circle cx="-40" cy="5" r="15" fill="#9FC7C6" stroke="#234E58" strokeWidth="4" />
        <circle cx="0" cy="-40" r="15" fill="#C9E7CE" stroke="#234E58" strokeWidth="4" />
        <circle cx="44" cy="5" r="15" fill="#F5B29D" stroke="#234E58" strokeWidth="4" />
        <circle cx="0" cy="47" r="15" fill="#B5DDBD" stroke="#234E58" strokeWidth="4" />
      </g>

      {/* repo -> graph */}
      <path
        d="M294 382 C320 382 334 382 349 382"
        fill="none"
        stroke="#234E58"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* top connection */}
      <path
        d="M419 260 C419 210 448 178 493 178 L515 178"
        fill="none"
        stroke="#234E58"
        strokeWidth="5"
      />
      <circle cx="420" cy="260" r="11" fill="#8CB7A8" stroke="#234E58" strokeWidth="4" />
      <circle cx="493" cy="178" r="11" fill="#8CB7A8" stroke="#234E58" strokeWidth="4" />

      {/* top AI card */}
      <g transform="translate(515 120)">
        <rect width="210" height="120" rx="10" fill="#FFFDF7" stroke="#234E58" strokeWidth="5" />
        <rect x="23" y="23" width="48" height="40" rx="10" fill="#DCECE5" stroke="#234E58" strokeWidth="4" />
        <path d="M35 34h24v18H45l-9 8 3-8h-4Z" fill="none" stroke="#234E58" strokeWidth="3.5" />
        <line x1="88" y1="28" x2="181" y2="28" stroke="#234E58" strokeWidth="5" strokeLinecap="round" />
        <line x1="88" y1="47" x2="181" y2="47" stroke="#234E58" strokeWidth="5" strokeLinecap="round" />
        <line x1="88" y1="66" x2="155" y2="66" stroke="#234E58" strokeWidth="5" strokeLinecap="round" />
        <rect x="60" y="77" width="53" height="32" rx="7" fill="#E9F2ED" />
        <text
          x="86"
          y="99"
          fontSize="20"
          textAnchor="middle"
          fontFamily="monospace"
          fontWeight="700"
          fill="#234E58"
        >
          &lt;/&gt;
        </text>
      </g>

      {/* document connection */}
      <path d="M466 315 H525" stroke="#234E58" strokeWidth="5" fill="none" />
      <circle cx="466" cy="315" r="11" fill="#A1C7B3" stroke="#234E58" strokeWidth="4" />

      {/* document */}
      <g transform="translate(540 275)">
        <rect width="162" height="135" rx="10" fill="#FFFDF7" stroke="#234E58" strokeWidth="5" />
        <line x1="28" y1="38" x2="130" y2="38" stroke="#234E58" strokeWidth="5" strokeLinecap="round" />
        <line x1="28" y1="60" x2="130" y2="60" stroke="#234E58" strokeWidth="5" strokeLinecap="round" />
        <line x1="28" y1="82" x2="111" y2="82" stroke="#234E58" strokeWidth="5" strokeLinecap="round" />
      </g>

      <circle cx="683" cy="381" r="25" fill="#B8DDBE" stroke="#234E58" strokeWidth="5" />
      <path d="M672 381l8 8 15-18" fill="none" stroke="#234E58" strokeWidth="4" />

      {/* architecture connection */}
      <path d="M430 386 C430 450 470 470 515 470" stroke="#234E58" strokeWidth="5" fill="none" />
      <circle cx="430" cy="386" r="11" fill="#A6CDB1" stroke="#234E58" strokeWidth="4" />
      <circle cx="515" cy="470" r="11" fill="#A6CDB1" stroke="#234E58" strokeWidth="4" />

      {/* architecture card */}
      <g transform="translate(515 420)">
        <rect width="220" height="130" rx="10" fill="#FFFDF7" stroke="#234E58" strokeWidth="5" />
        <rect x="88" y="18" width="47" height="28" rx="3" fill="#F3B19D" stroke="#234E58" strokeWidth="4" />
        <rect x="24" y="81" width="48" height="28" rx="3" fill="#B9D4D3" stroke="#234E58" strokeWidth="4" />
        <rect x="87" y="81" width="48" height="28" rx="3" fill="#E6ECE8" stroke="#234E58" strokeWidth="4" />
        <rect x="151" y="81" width="48" height="28" rx="3" fill="#C9DFC5" stroke="#234E58" strokeWidth="4" />
        <line x1="111" y1="46" x2="111" y2="63" stroke="#234E58" strokeWidth="4" />
        <line x1="48" y1="63" x2="175" y2="63" stroke="#234E58" strokeWidth="4" />
        <line x1="48" y1="63" x2="48" y2="81" stroke="#234E58" strokeWidth="4" />
        <line x1="111" y1="63" x2="111" y2="81" stroke="#234E58" strokeWidth="4" />
        <line x1="175" y1="63" x2="175" y2="81" stroke="#234E58" strokeWidth="4" />
      </g>

      {/* decorative trees */}
      <g stroke="#234E58" strokeWidth="5" fill="#FFFDF7">
        <ellipse cx="95" cy="520" rx="33" ry="58" />
        <line x1="95" y1="516" x2="95" y2="557" />
        <line x1="95" y1="530" x2="74" y2="507" />
        <line x1="95" y1="530" x2="116" y2="507" />
        <ellipse cx="742" cy="520" rx="31" ry="58" />
        <line x1="742" y1="515" x2="742" y2="558" />
      </g>
    </svg>
  );
}