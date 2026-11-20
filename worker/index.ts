export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  UPLOADS?: R2Bucket;
  BOOTSTRAP_KEY?: string;
}
type Role = "employee" | "team_leader" | "hse" | "manager" | "admin";
type CaseStatus = "open" | "review" | "resolved" | "released";
type User = { id:string; name:string; email:string; role:Role };
const roles = new Set<Role>(["employee","team_leader","hse","manager","admin"]);
const statuses = new Set<CaseStatus>(["open","review","resolved","released"]);
const json = (data:unknown,status=200,headers:Record<string,string>={}) =>
  Response.json(data,{status,headers:{"Cache-Control":"no-store",...headers}});
const bytesToHex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("");
async function digest(value:string){return bytesToHex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));}
async function passwordHash(password:string,salt:string){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:new TextEncoder().encode(salt),iterations:150000,hash:"SHA-256"},key,256);
  return bytesToHex(bits);
}
function cookie(request:Request,name:string){
  const raw=request.headers.get("Cookie")||"";
  return raw.split(";").map(v=>v.trim()).find(v=>v.startsWith(name+"="))?.slice(name.length+1)||"";
}
async function currentUser(request:Request,env:Env):Promise<User|null>{
  const token=cookie(request,"sw_session"); if(!token) return null;
  const row=await env.DB.prepare("SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>CURRENT_TIMESTAMP").bind(await digest(token)).first<User>();
  return row||null;
}
function publicUser(u:User){return {id:u.id,name:u.name,email:u.email,role:u.role};}
function roleLabel(role:Role){return ({employee:"Қызметкер",team_leader:"Топ жетекшісі",hse:"Еңбекті қорғау маманы",manager:"Басшы",admin:"Әкімші"} as Record<Role,string>)[role];}
async function createAccount(env:Env,name:string,email:string,password:string,role:Role):Promise<User>{
  const id=crypto.randomUUID(),salt=bytesToHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash=await passwordHash(password,salt);
  await env.DB.prepare("INSERT INTO users(id,name,email,password_hash,password_salt,role) VALUES(?,?,?,?,?,?)").bind(id,name,email.toLowerCase(),hash,salt,role).run();
  return {id,name,email:email.toLowerCase(),role};
}
async function startSession(env:Env,user:User){
  const token=bytesToHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  await env.DB.prepare("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,datetime('now','+7 days'))").bind(crypto.randomUUID(),user.id,await digest(token)).run();
  return "sw_session="+token+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800";
}
function caseView(row:Record<string,unknown>){return row;}
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(path==="/api/health"&&method==="GET"){
   try{await env.DB.prepare("SELECT 1").first();return json({ok:true,service:"stop-work-safety",storage:"d1-connected"});}
   catch{return json({ok:false,storage:"d1-error"},503);}
  }
  if(path==="/api/auth/bootstrap"&&method==="POST"){
   if(!env.BOOTSTRAP_KEY) return json({error:"Әкімшіні бастапқы тіркеу кілті серверде орнатылмаған."},503);
   let b:any;try{b=await request.json();}catch{return json({error:"Сұраныс пішімі қате."},400);}
   const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").first<{n:number}>();
   if((count?.n||0)>0) return json({error:"Әкімші бұрыннан тіркелген."},409);
   if(b.bootstrap_key!==env.BOOTSTRAP_KEY) return json({error:"Бастапқы тіркеу кілті қате."},403);
   const name=String(b.name||"").trim(),email=String(b.email||"").trim(),password=String(b.password||"");
   if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||password.length<10) return json({error:"Аты-жөні, дұрыс электрондық пошта және кемінде 10 таңбалы құпиясөз енгізіңіз."},400);
   try{const user=await createAccount(env,name,email,password,"admin");return json({user:publicUser(user)},201,{"Set-Cookie":await startSession(env,user)});}
   catch{return json({error:"Бұл электрондық пошта тіркелген болуы мүмкін."},409);}
  }
  if(path==="/api/auth/register"&&method==="POST"){
   let b:any;try{b=await request.json();}catch{return json({error:"Сұраныс пішімі қате."},400);}
   const name=String(b.name||"").trim(),email=String(b.email||"").trim(),password=String(b.password||"");
   if(name.length<2||name.length>120||!/^\S+@\S+\.\S+$/.test(email)||password.length<10) return json({error:"Аты-жөніңізді, дұрыс электрондық поштаны және кемінде 10 таңбалы құпиясөзді енгізіңіз."},400);
   const existing=await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email.toLowerCase()).first();
   if(existing) return json({error:"Бұл электрондық пошта бұрын тіркелген. Жүйеге кіру бөлімін пайдаланыңыз."},409);
   try{const user=await createAccount(env,name,email,password,"employee");return json({user:publicUser(user)},201,{"Set-Cookie":await startSession(env,user)});}
   catch{return json({error:"Тіркеу кезінде сервер қатесі болды. Дерекқор кестелері мен жарияланған Worker нұсқасын тексеру қажет."},500);}
  }
  if(path==="/api/auth/login"&&method==="POST"){
   let b:any;try{b=await request.json();}catch{return json({error:"Сұраныс пішімі қате."},400);}
   const email=String(b.email||"").trim().toLowerCase(),password=String(b.password||"");
   const row=await env.DB.prepare("SELECT id,name,email,password_hash,password_salt,role FROM users WHERE email=?").bind(email).first<any>();
   if(!row||await passwordHash(password,row.password_salt)!==row.password_hash) return json({error:"Электрондық пошта немесе құпиясөз қате."},401);
   const user:User={id:row.id,name:row.name,email:row.email,role:row.role};
   return json({user:publicUser(user)},200,{"Set-Cookie":await startSession(env,user)});
  }
  if(path==="/api/auth/logout"&&method==="POST"){
   const token=cookie(request,"sw_session");if(token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(token)).run();
   return json({ok:true},200,{"Set-Cookie":"sw_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"});
  }
  if(path==="/api/auth/me"&&method==="GET"){
   const user=await currentUser(request,env);return user?json({user:publicUser(user)}):json({user:null},401);
  }
  const user=await currentUser(request,env);
  if(path.startsWith("/api/")&&!user) return json({error:"Жүйеге кіру қажет."},401);
  if(path==="/api/users"&&method==="GET"){
   if(user!.role!=="admin") return json({error:"Бұл әрекетке әкімшінің ғана құқығы бар."},403);
   const result=await env.DB.prepare("SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC").all();
   return json({users:result.results||[]});
  }
  if(path==="/api/users"&&method==="POST"){
   if(user!.role!=="admin") return json({error:"Бұл әрекетке әкімшінің ғана құқығы бар."},403);
   let b:any;try{b=await request.json();}catch{return json({error:"Сұраныс пішімі қате."},400);}
   const name=String(b.name||"").trim(),email=String(b.email||"").trim(),password=String(b.password||""),role=b.role as Role;
   if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||password.length<10||!roles.has(role)) return json({error:"Мәліметтерді тексеріңіз. Құпиясөз кемінде 10 таңба болуы керек."},400);
   try{return json({user:publicUser(await createAccount(env,name,email,password,role))},201);}
   catch{return json({error:"Бұл электрондық пошта бұрын тіркелген."},409);}
  }
  if(path==="/api/cases"&&method==="GET"){
   const sql=user!.role==="employee"
    ?"SELECT id,location,hazard_type,description,status,reporter_id,created_at,updated_at FROM stop_cases WHERE reporter_id=? ORDER BY created_at DESC"
    :"SELECT id,location,hazard_type,description,status,reporter_id,created_at,updated_at FROM stop_cases ORDER BY created_at DESC";
   const result=user!.role==="employee"?await env.DB.prepare(sql).bind(user!.id).all():await env.DB.prepare(sql).all();
   return json({cases:(result.results||[]).map(r=>caseView(r as Record<string,unknown>))});
  }
  if(path==="/api/cases"&&method==="POST"){
   let b:any;try{b=await request.json();}catch{return json({error:"Сұраныс пішімі қате."},400);}
   const location=String(b.location||"").trim(),hazard=String(b.hazard_type||"").trim(),description=String(b.description||"").trim();
   if(!location||!hazard||!description||location.length>200||hazard.length>100||description.length>4000) return json({error:"Орынды, қауіп түрін және сипаттаманы дұрыс толтырыңыз."},400);
   const id="SW-"+crypto.randomUUID();
   try{
    await env.DB.prepare("INSERT INTO stop_cases(id,location,hazard_type,description,status,reporter_id) VALUES(?,?,?,?, 'open',?)").bind(id,location,hazard,description,user!.id).run();
    await env.DB.prepare("INSERT INTO case_events(case_id,actor_id,action,note) VALUES(?,?,?,?)").bind(id,user!.id,"created","STOP WORK хабарламасы тіркелді").run();
    const created=await env.DB.prepare("SELECT id,location,hazard_type,description,status,reporter_id,created_at,updated_at FROM stop_cases WHERE id=?").bind(id).first();
    return json({case:created},201);
   }catch{return json({error:"Хабарламаны сақтау мүмкін болмады."},500);}
  }
  const match=path.match(/^\/api\/cases\/([^/]+)$/);
  if(match&&method==="PATCH"){
   if(!["team_leader","hse","manager","admin"].includes(user!.role)) return json({error:"Өтінім мәртебесін өзгертуге құқығыңыз жоқ."},403);
   let b:any;try{b=await request.json();}catch{return json({error:"Сұраныс пішімі қате."},400);}
   const status=b.status as CaseStatus;
   if(!statuses.has(status)) return json({error:"Мәртебе дұрыс емес."},400);
   if(status==="released"&&!["hse","manager","admin"].includes(user!.role)) return json({error:"Жұмысты қайта бастауға тек еңбекті қорғау маманы немесе басшы рұқсат бере алады."},403);
   const id=decodeURIComponent(match[1]);
   try{
    const result=await env.DB.prepare("UPDATE stop_cases SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,id).run();
    if(!result.meta.changes) return json({error:"Өтінім табылмады."},404);
    await env.DB.prepare("INSERT INTO case_events(case_id,actor_id,action,note) VALUES(?,?,?,?)").bind(id,user!.id,"status:"+status,String(b.note||"").slice(0,1000)).run();
    const updated=await env.DB.prepare("SELECT id,location,hazard_type,description,status,reporter_id,created_at,updated_at FROM stop_cases WHERE id=?").bind(id).first();
    return json({case:updated});
   }catch{return json({error:"Мәртебені жаңарту мүмкін болмады."},500);}
  }
  if(path.startsWith("/api/")) return json({error:"Сұралған қызмет табылмады."},404);
  return env.ASSETS.fetch(request);
 }
};
