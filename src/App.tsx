import { useEffect, useMemo, useState } from "react";

type ApiStatus = "open" | "review" | "resolved" | "released";
type CaseStatus = "Открыт" | "На проверке" | "Устранено" | "Работы разрешены";
type StopCase = { id: string; place: string; risk: string; details: string; author: string; date: string; status: CaseStatus };
type ApiCase = { id: string; location: string; hazard_type: string; description: string; status: ApiStatus; reporter_id: string; created_at: string };

const statusToLabel: Record<ApiStatus, CaseStatus> = {
  open: "Открыт", review: "На проверке", resolved: "Устранено", released: "Работы разрешены"
};
const labelToStatus: Record<CaseStatus, ApiStatus> = {
  "Открыт": "open", "На проверке": "review", "Устранено": "resolved", "Работы разрешены": "released"
};
function fromApi(c: ApiCase): StopCase {
  return { id: c.id, place: c.location, risk: c.hazard_type, details: c.description,
    author: c.reporter_id === "anonymous" ? "Полевой сотрудник" : c.reporter_id,
    date: new Date(c.created_at.replace(" ", "T") + (c.created_at.endsWith("Z") ? "" : "Z")).toLocaleString(),
    status: statusToLabel[c.status] ?? "Открыт" };
}

export default function App() {
  const [lang, setLang] = useState<"ru" | "kz">("ru");
  const [cases, setCases] = useState<StopCase[]>([]);
  const [place, setPlace] = useState("");
  const [risk, setRisk] = useState("Работа на высоте");
  const [details, setDetails] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("Все");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const kz = lang === "kz";
  const t = (ru: string, kk: string) => kz ? kk : ru;
  const visible = useMemo(() => filter === "Все" ? cases : cases.filter(c => c.status === filter), [cases, filter]);

  async function loadCases() {
    setLoading(true);
    try {
      const response = await fetch("/api/cases");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить журнал");
      setCases((data.cases as ApiCase[]).map(fromApi));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Ошибка соединения с сервером");
    } finally { setLoading(false); }
  }
  useEffect(() => { void loadCases(); }, []);

  async function createCase(e: React.FormEvent) {
    e.preventDefault();
    if (!place.trim() || !details.trim() || busy) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/cases", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: place, hazard_type: risk, description: details, reporter_id: "anonymous" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить сообщение");
      if (data.case) setCases(old => [fromApi(data.case as ApiCase), ...old]);
      else await loadCases();
      setPlace(""); setDetails("");
      setNotice(t("STOP WORK сохранён в базе данных. Работы должны оставаться остановленными до проверки и официального разрешения.", "STOP WORK дерекқорға сақталды. Тексеру және ресми рұқсат берілгенге дейін жұмыс тоқтатылуы тиіс."));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Ошибка соединения с сервером");
    } finally { setBusy(false); }
  }

  async function updateStatus(id: string, status: CaseStatus) {
    if (busy) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(id)}`, { method: "PATCH",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: labelToStatus[status], actor_id: "operator" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось обновить статус");
      if (data.case) setCases(old => old.map(c => c.id === id ? fromApi(data.case as ApiCase) : c));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Ошибка соединения с сервером");
    } finally { setBusy(false); }
  }

  return <main className="shell">
    <header className="topbar"><div className="brand"><div className="brandmark">!</div><div><b>STOP WORK</b><small>{t("Производственная безопасность", "Өндірістік қауіпсіздік")}</small></div></div><button className="lang" onClick={() => setLang(lang === "ru" ? "kz" : "ru")}>{lang.toUpperCase()} / {lang === "ru" ? "KZ" : "RU"}</button></header>
    <section className="hero"><div className="eyebrow">{t("ПРАВО ОСТАНОВИТЬ НЕБЕЗОПАСНУЮ РАБОТУ", "ҚАУІПТІ ЖҰМЫСТЫ ТОҚТАТУ ҚҰҚЫҒЫ")}</div><h1>{t("Безопасность важнее сроков.", "Қауіпсіздік мерзімнен маңызды.")}</h1><p>{t("Обнаружили опасность? Остановите работу, сообщите о риске и дождитесь подтверждения безопасных условий.", "Қауіпті байқадыңыз ба? Жұмысты тоқтатып, қауіп туралы хабарлаңыз және қауіпсіз жағдай расталғанша күтіңіз.")}</p><div className="hero-note"><span>●</span> {t("Никаких санкций за добросовестное сообщение об опасности.", "Қауіп туралы адал хабарлағаны үшін жаза қолданылмайды.")}</div></section>
    <section className="content"><div className="section-head"><div><div className="eyebrow dark">{t("НОВОЕ СООБЩЕНИЕ", "ЖАҢА ХАБАРЛАМА")}</div><h2>{t("Остановить работу", "Жұмысты тоқтату")}</h2></div><span className="pill red">STOP WORK</span></div>
      <form className="form" onSubmit={createCase}><label>{t("Место / объект", "Орын / нысан")}<input value={place} onChange={e => setPlace(e.target.value)} placeholder={t("Например: участок ВОЛС, опора №12", "Мысалы: ВОЛС учаскесі, №12 тірек")} required /></label><label>{t("Тип опасности", "Қауіп түрі")}<select value={risk} onChange={e => setRisk(e.target.value)}><option>Работа на высоте</option><option>Электробезопасность</option><option>Транспорт и дорожное движение</option><option>Погодные условия</option><option>Инструмент и оборудование</option><option>Другое</option></select></label><label>{t("Опишите опасность", "Қауіпті сипаттаңыз")}<textarea value={details} onChange={e => setDetails(e.target.value)} rows={3} placeholder={t("Что произошло? Что может привести к травме?", "Не болды? Неден жарақат алу қаупі бар?")} required /></label><button className="stop-button" type="submit" disabled={busy}>{busy ? t("СОХРАНЕНИЕ...", "САҚТАЛУДА...") : `⏸ ${t("ЗАРЕГИСТРИРОВАТЬ STOP WORK", "STOP WORK ТІРКЕУ")}`}</button></form>
      {notice && <div className="notice" role="status">{notice}</div>}
    </section>
    <section className="content cases"><div className="section-head"><div><div className="eyebrow dark">{t("КОНТРОЛЬ И РЕАГИРОВАНИЕ", "БАҚЫЛАУ ЖӘНЕ ӘРЕКЕТ ЕТУ")}</div><h2>{t("Журнал остановок", "Тоқтату журналы")}</h2></div><span className="count">{cases.length} {t("случая", "жағдай")}</span></div>
      <div className="filters"><select value={filter} onChange={e => setFilter(e.target.value)}><option>Все</option><option>Открыт</option><option>На проверке</option><option>Устранено</option><option>Работы разрешены</option></select><button onClick={() => void loadCases()}>{t("Обновить", "Жаңарту")}</button></div>
      {loading ? <p>{t("Загрузка журнала...", "Журнал жүктелуде...")}</p> : <div className="case-list">{visible.map(c => <article className="case" key={c.id}><div className="case-top"><b>{c.id}</b><span className={`status ${c.status === "Устранено" || c.status === "Работы разрешены" ? "green" : "orange"}`}>{c.status}</span></div><h3>{c.risk}</h3><p className="place">{c.place}</p><p>{c.details}</p><div className="meta">{c.author} · {c.date}</div><div className="actions"><button disabled={busy} onClick={() => void updateStatus(c.id, "На проверке")}>{t("Взять на проверку", "Тексеруге алу")}</button><button disabled={busy} onClick={() => void updateStatus(c.id, "Устранено")}>{t("Опасность устранена", "Қауіп жойылды")}</button><button disabled={busy} onClick={() => void updateStatus(c.id, "Работы разрешены")}>{t("Разрешить работы", "Жұмысқа рұқсат беру")}</button></div></article>)}</div>}
      {!loading && visible.length === 0 && <p>{t("Записей пока нет.", "Әзірге жазбалар жоқ.")}</p>}
    </section><footer>{t("STOP WORK · MVP с подключением D1. Для промышленного запуска обязательно добавьте авторизацию и разграничение прав: сейчас API не защищён.", "STOP WORK · D1 қосылған MVP. Өндірістік іске қосу алдында авторизация мен рөлдерге қолжетімділікті міндетті түрде қосыңыз: қазір API қорғалмаған.")}</footer>
  </main>;
}
