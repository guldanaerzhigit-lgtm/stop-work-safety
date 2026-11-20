import { useMemo, useState } from "react";

type CaseStatus = "Открыт" | "На проверке" | "Устранено" | "Работы разрешены";
type StopCase = { id: string; place: string; risk: string; details: string; author: string; date: string; status: CaseStatus };
const initial: StopCase[] = [
  { id: "SW-001", place: "Участок ВОЛС · опора №14", risk: "Работа на высоте", details: "Не обнаружена подтверждённая точка анкерного крепления.", author: "Демонстрационный пользователь", date: "Сегодня, 09:40", status: "На проверке" },
  { id: "SW-002", place: "Узел связи · помещение 2", risk: "Электробезопасность", details: "Открытый электрический щит без ограждения.", author: "Полевой сотрудник", date: "Сегодня, 08:15", status: "Устранено" }
];
export default function App() {
  const [lang, setLang] = useState<"ru" | "kz">("ru");
  const [cases, setCases] = useState<StopCase[]>(initial);
  const [place, setPlace] = useState("");
  const [risk, setRisk] = useState("Работа на высоте");
  const [details, setDetails] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("Все");
  const kz = lang === "kz";
  const t = (ru: string, kk: string) => kz ? kk : ru;
  const visible = useMemo(() => filter === "Все" ? cases : cases.filter(c => c.status === filter), [cases, filter]);
  function createCase(e: React.FormEvent) {
    e.preventDefault();
    if (!place.trim() || !details.trim()) return;
    const item: StopCase = { id: `SW-${String(cases.length + 1).padStart(3, "0")}`, place, risk, details, author: t("Полевой сотрудник", "Дала қызметкері"), date: new Date().toLocaleString(), status: "Открыт" };
    setCases([item, ...cases]); setPlace(""); setDetails("");
    setNotice(t("Сообщение STOP WORK зарегистрировано. Работы должны оставаться остановленными до проверки и официального разрешения.", "STOP WORK хабарламасы тіркелді. Тексеру және ресми рұқсат берілгенге дейін жұмыс тоқтатылған күйде қалуы тиіс."));
  }
  function updateStatus(id: string, status: CaseStatus) { setCases(old => old.map(c => c.id === id ? { ...c, status } : c)); }
  return <main className="shell">
    <header className="topbar"><div className="brand"><div className="brandmark">!</div><div><b>STOP WORK</b><small>{t("Производственная безопасность", "Өндірістік қауіпсіздік")}</small></div></div><button className="lang" onClick={() => setLang(lang === "ru" ? "kz" : "ru")}>{lang.toUpperCase()} / {lang === "ru" ? "KZ" : "RU"}</button></header>
    <section className="hero"><div className="eyebrow">{t("ПРАВО ОСТАНОВИТЬ НЕБЕЗОПАСНУЮ РАБОТУ", "ҚАУІПТІ ЖҰМЫСТЫ ТОҚТАТУ ҚҰҚЫҒЫ")}</div><h1>{t("Безопасность важнее сроков.", "Қауіпсіздік мерзімнен маңызды.")}</h1><p>{t("Обнаружили опасность? Остановите работу, сообщите о риске и дождитесь подтверждения безопасных условий.", "Қауіпті байқадыңыз ба? Жұмысты тоқтатып, қауіп туралы хабарлаңыз және қауіпсіз жағдай расталғанша күтіңіз.")}</p><div className="hero-note"><span>●</span> {t("Никаких санкций за добросовестное сообщение об опасности.", "Қауіп туралы адал хабарлағаны үшін жаза қолданылмайды.")}</div></section>
    <section className="content"><div className="section-head"><div><div className="eyebrow dark">{t("НОВОЕ СООБЩЕНИЕ", "ЖАҢА ХАБАРЛАМА")}</div><h2>{t("Остановить работу", "Жұмысты тоқтату")}</h2></div><span className="pill red">STOP WORK</span></div>
      <form className="form" onSubmit={createCase}><label>{t("Место / объект", "Орын / нысан")}<input value={place} onChange={e => setPlace(e.target.value)} placeholder={t("Например: участок ВОЛС, опора №12", "Мысалы: ВОЛС учаскесі, №12 тірек")} required /></label><label>{t("Тип опасности", "Қауіп түрі")}<select value={risk} onChange={e => setRisk(e.target.value)}><option>Работа на высоте</option><option>Электробезопасность</option><option>Транспорт и дорожное движение</option><option>Погодные условия</option><option>Инструмент и оборудование</option><option>Другое</option></select></label><label>{t("Опишите опасность", "Қауіпті сипаттаңыз")}<textarea value={details} onChange={e => setDetails(e.target.value)} rows={3} placeholder={t("Что произошло? Что может привести к травме?", "Не болды? Неден жарақат алу қаупі бар?")} required /></label><button className="stop-button" type="submit">⏸ {t("ЗАРЕГИСТРИРОВАТЬ STOP WORK", "STOP WORK ТІРКЕУ")}</button></form>
      {notice && <div className="notice" role="status">{notice}</div>}
    </section>
    <section className="content cases"><div className="section-head"><div><div className="eyebrow dark">{t("КОНТРОЛЬ И РЕАГИРОВАНИЕ", "БАҚЫЛАУ ЖӘНЕ ӘРЕКЕТ ЕТУ")}</div><h2>{t("Журнал остановок", "Тоқтату журналы")}</h2></div><span className="count">{cases.length} {t("случая", "жағдай")}</span></div>
      <div className="filters"><select value={filter} onChange={e => setFilter(e.target.value)}><option>Все</option><option>Открыт</option><option>На проверке</option><option>Устранено</option><option>Работы разрешены</option></select></div>
      <div className="case-list">{visible.map(c => <article className="case" key={c.id}><div className="case-top"><b>{c.id}</b><span className={`status ${c.status === "Устранено" || c.status === "Работы разрешены" ? "green" : "orange"}`}>{c.status}</span></div><h3>{c.risk}</h3><p className="place">{c.place}</p><p>{c.details}</p><div className="meta">{c.author} · {c.date}</div><div className="actions"><button onClick={() => updateStatus(c.id, "На проверке")}>{t("Взять на проверку", "Тексеруге алу")}</button><button onClick={() => updateStatus(c.id, "Устранено")}>{t("Опасность устранена", "Қауіп жойылды")}</button><button onClick={() => updateStatus(c.id, "Работы разрешены")}>{t("Разрешить работы", "Жұмысқа рұқсат беру")}</button></div></article>)}</div>
    </section><footer>{t("STOP WORK · Демонстрационный MVP. Перед промышленным запуском подключите авторизацию, серверное хранение, аудит и регламент согласования.", "STOP WORK · Демонстрациялық MVP. Өндіріске енгізер алдында авторизацияны, серверлік сақтауды, аудитті және келісу тәртібін қосыңыз.")}</footer>
  </main>;
}