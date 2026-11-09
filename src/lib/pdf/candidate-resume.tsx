import "server-only";
import { join } from "node:path";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  descriptionLines,
  experienceDuration,
  isHeading,
  isNumbered,
  isTechStack,
} from "@/lib/experience-format";
import { formatMonths } from "@/lib/resume/score";
import {
  YEAR_FORMS,
  ageFrom,
  formatBirth,
  formatDate,
  formatMoney,
  plural,
} from "@/lib/format";

// Резюме кандидата одним PDF-файлом — чтобы отправить заказчику
// или руководителю, у которого нет доступа в LAMP.
//
// Собирается из карточки кандидата, а не из исходного файла: так все
// резюме выглядят одинаково, сколько бы разных форматов ни прислали
// кандидаты. Внутренние вещи компании — отзывы, этапы, комментарии
// рекрутера, метки — в файл не попадают.
//
// Файл строится целиком на нашем сервере, без внешних сервисов.

// Шрифт — Inter целиком, одним TTF на начертание. Шрифты интерфейса
// из public/fonts не подходят: они разрезаны по алфавитам под браузер,
// а в PDF нужен один файл, где есть и казахские Ә, Қ, Ң, Ө, Ү, Һ, и ₸.
// Чтобы файлы попали в сборку на Vercel, они перечислены
// в outputFileTracingIncludes в next.config.ts.
const FONT_DIR = join(process.cwd(), "src", "lib", "pdf", "fonts");

//
// Шрифт подключается заново перед каждой выгрузкой. Библиотека держит
// загруженный шрифт между документами, и после резюме с казахской «Қ»
// (внутри она собрана из обычной «К») следующий файл терял букву «К»:
// «Кандидат» печатался как «андидат». Свежая загрузка шрифта на каждый
// документ стоит миллисекунды и убирает эту ошибку.
Font.register({
  family: "Inter",
  fonts: [
    { src: join(FONT_DIR, "Inter-Regular.ttf"), fontWeight: 400 },
    { src: join(FONT_DIR, "Inter-SemiBold.ttf"), fontWeight: 600 },
    { src: join(FONT_DIR, "Inter-Bold.ttf"), fontWeight: 700 },
  ],
});

// Без этого библиотека переносит слова по английским правилам
// и режет русские слова в странных местах. Не переносим вовсе.
Font.registerHyphenationCallback((word) => [word]);

// Встроенный Font.reset() не годится: он стирает и стандартные шрифты
// библиотеки, но не даёт загрузить их заново, и следующая выгрузка
// падает. Поэтому сбрасываем только Inter — и данные, и признак
// «уже загружен», чтобы библиотека прочитала файлы ещё раз.
type FontSourceLike = { data: unknown; loadResultPromise: unknown };
function reloadInter() {
  const family = Font.getRegisteredFonts()["Inter"] as
    | { sources?: FontSourceLike[] }
    | undefined;
  for (const source of family?.sources ?? []) {
    source.data = null;
    source.loadResultPromise = null;
  }
}


// Цвета — из палитры интерфейса (src/app/globals.css).
const INK = "#181818";
const INK_STRONG = "#0f0f0f";
const INK_SOFT = "#5f5b54";
const LINE = "#ded8cc";
const MUTED = "#ede9df";
const ACCENT = "#f2c35b";

// Межстрочный интервал — всегда в пунктах и у каждого текста свой.
// Библиотека понимает его криво: число без единиц (1.45) она умножает
// не на размер шрифта текста, а на свой размер по умолчанию, и строки
// разъезжаются вдвое; заданный на всю страницу, он к тому же ломает
// номер страницы внизу (текст с render молча пропадает).
const lh = (fontSize: number) => `${(fontSize * 1.45).toFixed(1)}pt`;

const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 10,
    color: INK,
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
  },

  header: { flexDirection: "row", gap: 18 },
  photo: {
    width: 84,
    height: 104,
    borderRadius: 6,
    objectFit: "cover",
  },
  headerText: { flex: 1 },
  name: {
    fontSize: 20,
    fontWeight: 700,
    color: INK_STRONG,
    lineHeight: "24pt",
  },
  position: { marginTop: 4, fontSize: 13, fontWeight: 600, lineHeight: lh(13) },
  meta: { marginTop: 3, color: INK_SOFT, lineHeight: lh(10) },

  facts: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  fact: { marginRight: 22, marginBottom: 4 },
  factLabel: { fontSize: 8, color: INK_SOFT },
  factValue: { fontSize: 10.5, fontWeight: 600 },

  accentLine: {
    marginTop: 14,
    height: 2,
    backgroundColor: ACCENT,
  },

  section: { marginTop: 18 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: INK_STRONG,
    paddingBottom: 4,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },

  job: {
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
  },
  jobLast: { borderBottomWidth: 0 },
  jobHead: { flexDirection: "row" },
  jobWhen: { width: 108, paddingRight: 10, color: INK_SOFT },
  jobPeriod: { lineHeight: lh(10) },
  jobWhenSmall: { fontSize: 8.5, color: INK_SOFT, lineHeight: lh(8.5) },
  jobTitle: { flex: 1 },
  jobPosition: { fontSize: 11, fontWeight: 700, color: INK_STRONG },
  jobCompany: { marginTop: 1, lineHeight: lh(10) },
  // Обязанности — под должностью, с тем же отступом слева.
  jobDescription: { marginLeft: 108 },

  description: { marginTop: 5 },
  paragraph: { marginTop: 2, lineHeight: lh(10) },
  subheading: { marginTop: 5, fontWeight: 600, lineHeight: lh(10) },
  techStack: {
    marginTop: 2,
    fontSize: 8.5,
    color: INK_SOFT,
    lineHeight: lh(8.5),
  },
  bulletRow: { flexDirection: "row", marginTop: 2 },
  bulletDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: INK_SOFT,
    marginTop: 5.5,
    marginRight: 6,
  },
  bulletText: { flex: 1, lineHeight: lh(10) },

  education: { marginBottom: 7 },
  educationTitle: { fontWeight: 600, lineHeight: lh(10) },
  educationSoft: { color: INK_SOFT, lineHeight: lh(10) },

  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    backgroundColor: MUTED,
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginRight: 4,
    marginBottom: 4,
    fontSize: 9,
  },

  footerLine: {
    position: "absolute",
    left: 44,
    right: 44,
    bottom: 38,
    height: 0.5,
    backgroundColor: LINE,
  },
  footerLeft: {
    position: "absolute",
    left: 44,
    bottom: 24,
    fontSize: 8,
    color: INK_SOFT,
  },
  // Номер страницы: на всю ширину и выровнен по правому краю.
  footerRight: {
    position: "absolute",
    left: 44,
    right: 44,
    bottom: 24,
    fontSize: 8,
    color: INK_SOFT,
    textAlign: "right",
  },
});

export type CandidatePdfData = {
  fullName: string;
  currentPosition: string | null;
  city: string | null;
  birthDate: Date | null;
  experienceYears: number | null;
  experienceMonths: number | null;
  salaryExpectation: number | null;
  currency: string;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  skills: string[];
  languages: string[];
  experience: {
    id: string;
    companyName: string;
    position: string | null;
    period: string | null;
    description: string | null;
  }[];
  education: {
    id: string;
    institution: string;
    specialty: string | null;
    years: string | null;
  }[];
  // Фото в JPEG — так его сохраняет разбор резюме (lib/resume/photo.ts).
  photo: Buffer | null;
  companyName: string;
  // false — выгрузка без телефона, почты и Telegram: например,
  // для заказчика, который не должен связываться с кандидатом напрямую.
  showContacts: boolean;
  // Анонимно: ни имени, ни фото, ни контактов, ни даты рождения —
  // только возраст. Для заказчика, который выбирает по опыту,
  // а не по фамилии.
  anonymous: boolean;
};

// Что написать вместо имени и как подписать возраст и город
// в анонимной выгрузке. Общее для PDF и Word.
export function exportHeading(data: CandidatePdfData): {
  name: string;
  meta: string;
} {
  if (data.anonymous) {
    const age = ageFrom(data.birthDate);
    return {
      name: "Кандидат",
      meta: [age !== null ? `${age} ${plural(age, YEAR_FORMS)}` : null, data.city]
        .filter(Boolean)
        .join(" · "),
    };
  }
  return {
    name: data.fullName,
    meta: [formatBirth(data.birthDate), data.city].filter(Boolean).join(" · "),
  };
}

// Стаж: сначала посчитанный по датам мест работы, он точнее.
export function experienceText(data: CandidatePdfData): string | null {
  if (data.experienceMonths && data.experienceMonths > 0) {
    return formatMonths(data.experienceMonths);
  }
  if (data.experienceYears !== null) {
    return `${data.experienceYears} ${plural(data.experienceYears, YEAR_FORMS)}`;
  }
  return null;
}

// «Март 2021 — Июль 2024»: месяц и год склеиваем неразрывным
// пробелом, чтобы строка переносилась после тире, а не «Июль / 2024».
function keepMonthWithYear(period: string): string {
  return period.replace(/([А-ЯЁа-яёA-Za-z]+) (\d{4})/g, "$1 $2");
}

// Одна строка описания обязанностей. single — описание из одной
// фразы: тогда это просто абзац, без точки-маркера.
function DescriptionLine({ line, single }: { line: string; single: boolean }) {
  if (single || isNumbered(line)) {
    return <Text style={styles.paragraph}>{line}</Text>;
  }
  if (isHeading(line)) {
    return <Text style={styles.subheading}>{line}</Text>;
  }
  if (isTechStack(line)) {
    return <Text style={styles.techStack}>{line}</Text>;
  }
  return (
    <View style={styles.bulletRow} wrap={false}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{line}</Text>
    </View>
  );
}

// Строки описания, сгруппированные так, чтобы подзаголовок
// («Достижения:») не оставался один внизу страницы: он идёт
// одним неразрывным куском со следующей строкой.
function descriptionBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isHeading(lines[i]) && i + 1 < lines.length) {
      blocks.push([lines[i], lines[i + 1]]);
      i++;
    } else {
      blocks.push([lines[i]]);
    }
  }
  return blocks;
}

function DescriptionBlock({
  block,
  single,
}: {
  block: string[];
  single: boolean;
}) {
  return (
    <View wrap={false}>
      {block.map((line, index) => (
        <DescriptionLine key={index} line={line} single={single} />
      ))}
    </View>
  );
}

// Место работы. Разрывы страниц расставляются явно, через wrap={false}:
// подсказка библиотеки minPresenceAhead в связке с длинными описаниями
// то оставляла должность одну внизу страницы, то переносила целое место
// работы и оставляла полстраницы пустыми.
//
// Неразрывно идут: (заголовок раздела, если это первое место работы) +
// период, должность, компания + первый кусок обязанностей.
function Job({
  item,
  last,
  sectionTitle,
}: {
  item: CandidatePdfData["experience"][number];
  last: boolean;
  sectionTitle?: string;
}) {
  const length = experienceDuration(item.period);
  const lines = item.description ? descriptionLines(item.description) : [];
  const single = lines.length === 1;
  const [first, ...rest] = descriptionBlocks(lines);

  return (
    <View style={last ? [styles.job, styles.jobLast] : styles.job}>
      <View wrap={false}>
        {sectionTitle && (
          <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        )}
        <View style={styles.jobHead}>
          <View style={styles.jobWhen}>
            {item.period && (
              <Text style={styles.jobPeriod}>
                {keepMonthWithYear(item.period)}
              </Text>
            )}
            {length && <Text style={styles.jobWhenSmall}>{length}</Text>}
          </View>
          <View style={styles.jobTitle}>
            <Text style={styles.jobPosition}>
              {item.position ?? "Должность не указана"}
            </Text>
            <Text style={styles.jobCompany}>{item.companyName}</Text>
          </View>
        </View>
        {first && (
          <View style={[styles.jobDescription, styles.description]}>
            <DescriptionBlock block={first} single={single} />
          </View>
        )}
      </View>

      {rest.length > 0 && (
        <View style={styles.jobDescription}>
          {rest.map((block, index) => (
            <DescriptionBlock key={index} block={block} single={single} />
          ))}
        </View>
      )}
    </View>
  );
}

// Небольшой раздел (образование, навыки, языки) целиком
// переносится на следующую страницу, если не помещается:
// заголовок не остаётся один внизу.
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <View style={styles.chips}>
      {items.map((item, index) => (
        <Text key={`${item}-${index}`} style={styles.chip}>
          {item}
        </Text>
      ))}
    </View>
  );
}

function CandidateResume({ data }: { data: CandidatePdfData }) {
  const heading = exportHeading(data);
  const metaLine = heading.meta;

  const facts = [
    { label: "Опыт работы", value: experienceText(data) },
    {
      label: "Зарплатные ожидания",
      value:
        data.salaryExpectation !== null
          ? formatMoney(data.salaryExpectation, data.currency)
          : null,
    },
    ...(data.showContacts
      ? [
          { label: "Телефон", value: data.phone },
          { label: "Email", value: data.email },
          {
            label: "Telegram",
            value: data.telegram ? `@${data.telegram}` : null,
          },
        ]
      : []),
  ].filter((fact) => fact.value);

  return (
    <Document
      title={`${heading.name} — резюме`}
      author={data.companyName}
      creator="LAMP"
      producer="LAMP"
      language="ru"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {data.photo && (
            // eslint-disable-next-line jsx-a11y/alt-text -- в PDF нет alt
            <Image
              style={styles.photo}
              src={{ data: data.photo, format: "jpg" }}
            />
          )}
          <View style={styles.headerText}>
            <Text style={styles.name}>{heading.name}</Text>
            {data.currentPosition && (
              <Text style={styles.position}>{data.currentPosition}</Text>
            )}
            {metaLine && <Text style={styles.meta}>{metaLine}</Text>}

            {facts.length > 0 && (
              <View style={styles.facts}>
                {facts.map((fact) => (
                  <View key={fact.label} style={styles.fact}>
                    <Text style={styles.factLabel}>{fact.label}</Text>
                    <Text style={styles.factValue}>{fact.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.accentLine} />

        {/* Раздел опыта может занимать несколько страниц, поэтому
            целиком его не переносим, а заголовок склеиваем с первым
            местом работы. */}
        {data.experience.length > 0 && (
          <View style={styles.section}>
            {data.experience.map((item, index) => (
              <Job
                key={item.id}
                item={item}
                last={index === data.experience.length - 1}
                sectionTitle={index === 0 ? "Опыт работы" : undefined}
              />
            ))}
          </View>
        )}

        {data.education.length > 0 && (
          <Section title="Образование">
            {data.education.map((item) => (
              <View key={item.id} style={styles.education} wrap={false}>
                <Text style={styles.educationTitle}>{item.institution}</Text>
                {item.specialty && (
                  <Text style={styles.educationSoft}>{item.specialty}</Text>
                )}
                {item.years && (
                  <Text style={styles.educationSoft}>{item.years}</Text>
                )}
              </View>
            ))}
          </Section>
        )}

        {data.skills.length > 0 && (
          <Section title="Навыки">
            <Chips items={data.skills} />
          </Section>
        )}

        {data.languages.length > 0 && (
          <Section title="Языки">
            <Chips items={data.languages} />
          </Section>
        )}
        {/* fixed — повторяется внизу каждой страницы. */}
        <View style={styles.footerLine} fixed />
        <Text style={styles.footerLeft} fixed>
          {data.companyName} · {formatDate(new Date())}
        </Text>
        <Text
          style={styles.footerRight}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

export async function renderCandidatePdf(
  data: CandidatePdfData,
): Promise<Buffer> {
  reloadInter();
  return renderToBuffer(<CandidateResume data={data} />);
}
