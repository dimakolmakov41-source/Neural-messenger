const SUPABASE_URL="https://mxisxongnlgiscruupgw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_WtMKmD1c-jdcUcjPazfPAg_TPicsc1B";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
let mode="login",user=null,activeConversation=null,realtimeChannel=null,conversations=[],profile=null;

function notice(id,text,good=false){const el=$(id);el.textContent=text;el.classList.toggle("good",good)}
function setMode(next){mode=next;$("loginTab").classList.toggle("active",mode==="login");$("registerTab").classList.toggle("active",mode==="register");$("authSubmit").textContent=mode==="login"?"Войти":"Создать аккаунт";$("password").autocomplete=mode==="login"?"current-password":"new-password";notice("authMessage","")}
$("loginTab").onclick=()=>setMode("login");$("registerTab").onclick=()=>setMode("register");

$("authForm").addEventListener("submit",async e=>{
 e.preventDefault();const email=$("email").value.trim(),password=$("password").value;
 if(password.length<6){notice("authMessage","Пароль должен содержать минимум 6 символов.");return}
 const btn=$("authSubmit");btn.disabled=true;btn.textContent="Подождите…";notice("authMessage","");
 try{
  if(mode==="register"){
   const {data,error}=await db.auth.signUp({email,password});if(error)throw error;
   if(data.session){await startApp(data.user)}else{notice("authMessage","Аккаунт создан! Подтверди почту по письму, затем войди.",true);setMode("login")}
  }else{const {data,error}=await db.auth.signInWithPassword({email,password});if(error)throw error;await startApp(data.user)}
 }catch(err){notice("authMessage",friendlyError(err.message))}
 finally{btn.disabled=false;btn.textContent=mode==="login"?"Войти":"Создать аккаунт"}
});
function friendlyError(s){if(/Invalid login credentials/i.test(s))return"Неверная почта или пароль.";if(/User already registered/i.test(s))return"Этот адрес уже зарегистрирован. Попробуй войти.";return s||"Не удалось выполнить запрос."}
async function startApp(current){
 user=current;
 const {data:p,error}=await db.from("profiles").select("*").eq("id",user.id).maybeSingle();
 if(error)console.error("profile",error);
 profile=p||{display_name:user.email?.split("@")[0]||"Пользователь",username:""};
 $("myName").textContent=profile.display_name||profile.username||"Пользователь";$("myEmail").textContent="@"+(profile.username||"");$("myAvatar").textContent=($("myName").textContent[0]||"N").toUpperCase();
 $("authView").classList.add("hidden");$("appView").classList.remove("hidden");
 await loadConversations();
}
async function loadConversations(){
 const {data,error}=await db.from("conversations").select("id,title,is_group,created_at").order("created_at",{ascending:false});
 if(error){console.error(error);$("chatList").innerHTML='<div class="empty">Не удалось загрузить чаты</div>';return}
 conversations=data||[];const ids=conversations.map(c=>c.id);
 let members=[];
 if(ids.length){const r=await db.from("conversation_members").select("conversation_id,user_id").in("conversation_id",ids);if(!r.error)members=r.data||[]}
 const otherIds=[...new Set(members.map(m=>m.user_id).filter(id=>id!==user.id))];
 let people={};if(otherIds.length){const r=await db.from("profiles").select("id,username,display_name").in("id",otherIds);if(!r.error)for(const p of r.data||[])people[p.id]=p}
 $("chatList").innerHTML="";
 if(!conversations.length){$("chatList").innerHTML='<div class="empty">Пока нет чатов.<br>Нажми ＋, чтобы начать.</div>';return}
 conversations.forEach(c=>{
  const peer=members.filter(m=>m.conversation_id===c.id&&m.user_id!==user.id).map(m=>people[m.user_id]).filter(Boolean)[0];
  const title=c.title||(peer?.display_name||peer?.username||"Личный чат");
  const b=document.createElement("button");b.className="chat-item"+(activeConversation?.id===c.id?" active":"");b.innerHTML='<div class="avatar"></div><div><div class="chat-name"></div><small></small></div>';
  b.querySelector(".avatar").textContent=title[0].toUpperCase();b.querySelector(".chat-name").textContent=title;b.querySelector("small").textContent=peer?"@"+peer.username:"Нажми, чтобы открыть";
  b.onclick=()=>openConversation(c,peer,title);$("chatList").appendChild(b);
 });
}
async function openConversation(c,peer,title){
 activeConversation=c;$("welcome").classList.add("hidden");$("conversation").classList.remove("hidden");
 $("peerName").textContent=title;$("peerStatus").textContent=peer?"@"+peer.username:"Личный разговор";$("peerAvatar").textContent=title[0].toUpperCase();
 await loadMessages();
 if(realtimeChannel)await db.removeChannel(realtimeChannel);
 realtimeChannel=db.channel("messages-"+c.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"conversation_id=eq."+c.id},payload=>renderMessage(payload.new)).subscribe();
 await loadConversations();
}
async function loadMessages(){
 $("messages").innerHTML='<div class="empty">Загрузка сообщений…</div>';
 const {data,error}=await db.from("messages").select("*").eq("conversation_id",activeConversation.id).order("created_at",{ascending:true}).limit(200);
 if(error){$("messages").innerHTML='<div class="empty">Не удалось загрузить сообщения. Проверь доступ к чату.</div>';return}
 $("messages").innerHTML="";(data||[]).forEach(renderMessage);scrollMessages();
}
function renderMessage(m){
 if(!activeConversation||m.conversation_id!==activeConversation.id)return;
 if($("messages").querySelector('[data-id="'+m.id+'"]'))return;
 const el=document.createElement("div");el.className="bubble"+(m.sender_id===user.id?" mine":"");el.dataset.id=m.id;
 const body=document.createElement("div");body.textContent=m.content;const time=document.createElement("time");time.textContent=new Date(m.created_at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});el.append(body,time);$("messages").appendChild(el);scrollMessages();
}
function scrollMessages(){$("messages").scrollTop=$("messages").scrollHeight}
$("messageForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!activeConversation)return;const input=$("messageInput"),content=input.value.trim();if(!content)return;
 const btn=e.submitter;btn.disabled=true;
 const {error}=await db.from("messages").insert({conversation_id:activeConversation.id,sender_id:user.id,content});
 btn.disabled=false;if(error){alert("Не удалось отправить сообщение: "+error.message);return}input.value="";
});
function openNewChat(){$("newChatMessage").textContent="";$("usernameInput").value="";$("newChatDialog").showModal();$("usernameInput").focus()}
$("newChatBtn").onclick=openNewChat;$("welcomeNew").onclick=openNewChat;$("closeDialog").onclick=()=>$("newChatDialog").close();
$("newChatForm").addEventListener("submit",async e=>{
 e.preventDefault();const username=$("usernameInput").value.trim().replace(/^@/,"");notice("newChatMessage","Ищем пользователя…",true);
 const {data:target,error}=await db.from("profiles").select("id,username,display_name").eq("username",username).maybeSingle();
 if(error){notice("newChatMessage",error.message);return}if(!target){notice("newChatMessage","Пользователь не найден. Проверь username.");return}
 if(target.id===user.id){notice("newChatMessage","Нельзя создать чат с самим собой.");return}
 const {data:existing}=await db.from("conversation_members").select("conversation_id").eq("user_id",user.id);
 const existingIds=(existing||[]).map(x=>x.conversation_id);
 if(existingIds.length){
  const {data:shared}=await db.from("conversation_members").select("conversation_id").eq("user_id",target.id).in("conversation_id",existingIds);
  if(shared?.length){const c=conversations.find(x=>x.id===shared[0].conversation_id);if(c){$("newChatDialog").close();await openConversation(c,target,target.display_name||target.username);return}}
 }
 const {data:conv,error:ce}=await db.from("conversations").insert({created_by:user.id,is_group:false}).select().single();
 if(ce){notice("newChatMessage",ce.message);return}
 const {error:me}=await db.from("conversation_members").insert([{conversation_id:conv.id,user_id:user.id},{conversation_id:conv.id,user_id:target.id}]);
 if(me){notice("newChatMessage",me.message);await db.from("conversations").delete().eq("id",conv.id);return}
 $("newChatDialog").close();await loadConversations();await openConversation(conv,target,target.display_name||target.username);
});
$("logoutBtn").onclick=async()=>{await db.auth.signOut();if(realtimeChannel)await db.removeChannel(realtimeChannel);user=null;activeConversation=null;$("appView").classList.add("hidden");$("authView").classList.remove("hidden");$("authForm").reset();setMode("login")};
db.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"&&!session&&user){user=null;$("appView").classList.add("hidden");$("authView").classList.remove("hidden")}});
(async()=>{const {data}=await db.auth.getSession();if(data.session)await startApp(data.session.user)})();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) { window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(err=>console.warn("PWA registration:",err))); }
