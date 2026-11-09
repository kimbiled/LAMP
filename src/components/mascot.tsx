import type { MascotLook } from "@/lib/mascot";

// Персонаж LAMP: папка с резюме, которая шагает с календарём в руке.
// Нарисован кодом (SVG), поэтому каждую деталь можно менять:
// цвет папки, головной убор, очки, предмет в руке и обувь.
// Без хуков и состояния — подходит и для серверных страниц.

const INK = "#1c1c1c";

const COLORS: Record<string, { body: string; back: string }> = {
  khaki: { body: "#8f956a", back: "#777d55" },
  sky: { body: "#86a8d2", back: "#6d8fba" },
  terracotta: { body: "#d0805a", back: "#b46a47" },
  lavender: { body: "#a895d0", back: "#8f7cba" },
  graphite: { body: "#707075", back: "#5a5a5f" },
  gold: { body: "#e3b84e", back: "#c99f3a" },
};

const SHOES: Record<string, { fill: string; sole: string }> = {
  black: { fill: "#3a3a3a", sole: "#3a3a3a" },
  red: { fill: "#d9473f", sole: "#ffffff" },
  white: { fill: "#f6f6f6", sole: "#d6d6d6" },
  gold: { fill: "#e3b84e", sole: "#a87f22" },
};

const line = {
  stroke: INK,
  strokeWidth: 4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Hat({ id }: { id: string }) {
  switch (id) {
    case "cap":
      return (
        <g>
          <path d="M98 26 Q99 -2 131 -2 Q163 -2 164 24 Z" fill="#d9473f" {...line} />
          <path d="M150 22 Q180 18 194 28 Q172 34 150 30 Z" fill="#b8352e" {...line} />
          <circle cx="131" cy="-2" r="4" fill="#b8352e" {...line} strokeWidth={3} />
        </g>
      );
    case "beret":
      return (
        <g transform="rotate(-10 128 18)">
          <ellipse cx="126" cy="18" rx="42" ry="13" fill="#3e3f6e" {...line} />
          <path d="M126 5 Q128 -2 133 -1" fill="none" {...line} strokeWidth={3} />
        </g>
      );
    case "party":
      return (
        <g>
          <path d="M108 24 L131 -26 L155 22 Z" fill="#f2c35b" {...line} />
          <path
            d="M116 8 L146 2 M122 -6 L141 -10"
            stroke="#d9473f"
            strokeWidth={4}
            strokeLinecap="round"
          />
          <circle cx="131" cy="-28" r="6" fill="#d9473f" {...line} strokeWidth={3} />
        </g>
      );
    case "crown":
      return (
        <g>
          <path
            d="M100 24 L103 -4 L118 10 L131 -12 L144 10 L159 -4 L162 24 Z"
            fill="#f2c35b"
            {...line}
          />
          <circle cx="131" cy="12" r="4" fill="#d9473f" />
          <circle cx="114" cy="16" r="3" fill="#4f7fcf" />
          <circle cx="148" cy="16" r="3" fill="#4f7fcf" />
        </g>
      );
    default:
      return null;
  }
}

function Item({ id }: { id: string }) {
  switch (id) {
    case "coffee":
      return (
        <g>
          <path
            d="M226 46 Q220 38 226 30 M236 46 Q230 38 236 30"
            fill="none"
            stroke="#8a847a"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <path d="M206 58 H246 L241 100 H211 Z" fill="#ffffff" {...line} />
          <rect x="204" y="52" width="44" height="9" rx="3" fill="#6b4a2b" {...line} strokeWidth={3} />
          <rect x="209" y="72" width="34" height="14" fill="#c98b4e" stroke={INK} strokeWidth={3} />
        </g>
      );
    case "magnifier":
      return (
        <g>
          <path d="M222 100 L234 80" stroke="#6b4a2b" strokeWidth={9} strokeLinecap="round" />
          <circle
            cx="242"
            cy="62"
            r="20"
            fill="#e3f0ff"
            fillOpacity={0.7}
            {...line}
            strokeWidth={5}
          />
          <path
            d="M232 54 Q236 48 244 48"
            fill="none"
            stroke="#ffffff"
            strokeWidth={4}
            strokeLinecap="round"
          />
        </g>
      );
    case "flower":
      return (
        <g>
          <path
            d="M222 100 Q224 80 228 58"
            fill="none"
            stroke="#4f8a3e"
            strokeWidth={5}
            strokeLinecap="round"
          />
          <path
            d="M224 82 Q212 76 210 66 Q222 68 226 78"
            fill="#6aa553"
            stroke={INK}
            strokeWidth={2.5}
          />
          {[0, 72, 144, 216, 288].map((angle) => (
            <ellipse
              key={angle}
              cx="228"
              cy="38"
              rx="8"
              ry="13"
              fill="#f29bb4"
              stroke={INK}
              strokeWidth={2.5}
              transform={`rotate(${angle} 228 50)`}
            />
          ))}
          <circle cx="228" cy="50" r="7" fill="#f2c35b" stroke={INK} strokeWidth={2.5} />
        </g>
      );
    case "trophy":
      return (
        <g>
          <path d="M206 44 H246 Q246 76 226 80 Q206 76 206 44 Z" fill="#f2c35b" {...line} />
          <path
            d="M206 50 Q192 50 196 62 Q200 70 208 66 M246 50 Q260 50 256 62 Q252 70 244 66"
            fill="none"
            {...line}
            strokeWidth={3.5}
          />
          <path d="M222 80 V90 H230 V80" fill="#e0b44a" {...line} strokeWidth={3} />
          <rect x="212" y="88" width="28" height="8" rx="2" fill="#6b4a2b" {...line} strokeWidth={3} />
          <path
            d="M219 56 L226 50 V68"
            fill="none"
            stroke="#a87f22"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
      );
    default:
      // Календарь с галочкой — как на исходной картинке.
      return (
        <g transform="rotate(8 228 66)">
          <rect x="198" y="38" width="60" height="56" rx="4" fill="#f2c35b" {...line} />
          <rect x="211" y="52" width="34" height="30" rx="4" fill="none" {...line} strokeWidth={3} />
          <path d="M211 61 H245" {...line} strokeWidth={3} />
          <path d="M219 47 V55 M237 47 V55" {...line} strokeWidth={3} />
          <path d="M220 70 L226 75 L236 65" fill="none" {...line} strokeWidth={3.5} />
        </g>
      );
  }
}

function Glasses({ id }: { id: string }) {
  if (id === "round") {
    return (
      <g fill="#ffffff" fillOpacity={0.18} {...line} strokeWidth={3.5}>
        <circle cx="102" cy="166" r="15" />
        <circle cx="156" cy="161" r="15" />
        <path d="M117 164 Q129 158 141 162" fill="none" />
      </g>
    );
  }
  if (id === "sun") {
    return (
      <g {...line} strokeWidth={3.5}>
        <path d="M84 158 H120 Q120 178 102 178 Q84 178 84 158 Z" fill={INK} />
        <path d="M138 153 H174 Q174 173 156 173 Q138 173 138 153 Z" fill={INK} />
        <path d="M120 159 Q129 154 138 155" fill="none" />
        <path d="M92 162 L100 162" stroke="#ffffff" strokeWidth={2.5} strokeOpacity={0.7} />
      </g>
    );
  }
  return null;
}

export function Mascot({
  look,
  size = 160,
  title = "Персонаж LAMP",
  className = "",
}: {
  look: MascotLook;
  size?: number;
  title?: string;
  className?: string;
}) {
  const color = COLORS[look.color] ?? COLORS.khaki;
  const shoes = SHOES[look.shoes] ?? SHOES.black;

  return (
    <svg
      viewBox="0 -40 270 345"
      width={size}
      height={(size * 345) / 270}
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>

      {/* Тень */}
      <ellipse cx="132" cy="298" rx="78" ry="6" fill={INK} opacity={0.08} />

      {/* Ноги и обувь */}
      <path d="M108 252 Q104 272 98 286" fill="none" {...line} strokeWidth={7} />
      <path d="M154 252 Q162 270 172 282" fill="none" {...line} strokeWidth={7} />
      <path
        d="M78 296 Q78 284 94 284 L104 285 Q116 287 116 295 V298 H78 Z"
        fill={shoes.fill}
        {...line}
        strokeWidth={3.5}
      />
      <path d="M79 297 H115" stroke={shoes.sole} strokeWidth={3} />
      <path
        d="M160 290 Q162 278 176 279 L188 281 Q200 284 199 292 L198 295 H160 Z"
        fill={shoes.fill}
        {...line}
        strokeWidth={3.5}
      />
      <path d="M161 294 H197" stroke={shoes.sole} strokeWidth={3} />

      {/* Задняя стенка папки */}
      <path
        d="M62 88 Q62 80 70 80 H112 L122 92 H196 Q204 92 204 100 L200 246 Q200 252 194 252 H68 Q62 252 62 246 Z"
        fill={color.back}
        {...line}
      />

      {/* Резюме, торчащее из папки, и шапка на нём */}
      <g transform="rotate(-5 128 70)">
        <rect x="78" y="24" width="106" height="96" rx="3" fill="#fbf8f0" {...line} />
        <circle cx="101" cy="49" r="9" fill={INK} />
        <path d="M86 75 Q86 61 101 61 Q116 61 116 75 Z" fill={INK} />
        <path d="M126 46 H170 M126 58 H170 M126 70 H160" {...line} />
        <Hat id={look.hat} />
      </g>

      {/* Передняя стенка с ярлычком */}
      <path
        d="M54 106 Q54 100 60 100 H118 L128 112 H204 Q210 112 209 118 L198 250 Q197 258 189 258 H74 Q66 258 65 250 Z"
        fill={color.body}
        {...line}
      />

      {/* Левая рука */}
      <path d="M60 170 Q34 184 38 212" fill="none" {...line} strokeWidth={7} />
      <circle cx="40" cy="220" r="13" fill={color.body} {...line} />

      {/* Правая рука с предметом */}
      <path d="M203 160 Q228 140 222 108" fill="none" {...line} strokeWidth={7} />
      <Item id={look.item} />
      <circle cx="222" cy="102" r="12" fill={color.body} {...line} />

      {/* Лицо: прищур, бровь, ухмылка */}
      <path d="M88 166 Q102 159 116 165" fill="none" {...line} strokeWidth={5} />
      <ellipse cx="104" cy="169" rx="5" ry="3.5" fill={INK} />
      <path d="M142 161 Q155 154 169 160" fill="none" {...line} strokeWidth={5} />
      <ellipse cx="158" cy="164" rx="5" ry="3.5" fill={INK} />
      <path d="M144 140 Q158 128 174 136" fill="none" {...line} strokeWidth={4} />
      <path d="M106 204 Q133 218 162 199" fill="none" {...line} />

      <Glasses id={look.glasses} />
    </svg>
  );
}
