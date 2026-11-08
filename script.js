// Neural Messenger — Supabase Auth
// Publishable key is intended for browser use. Never put a Supabase secret/service_role key here.
const SUPABASE_URL = "https://mxisxongnlgiscruupgw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_WtMKmD1c-jdcUcjPazfPAg_TPicsc1B";

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const authForm = document.getElementById("authForm");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const submitButton = document.getElementById("submitButton");
const message = document.getElementById("message");
const authCard = document.getElementById("authCard");
const accountCard = document.getElementById("accountCard");
const accountEmail = document.getElementById("accountEmail");
const logoutButton = document.getElementById("logoutButton");
let mode = "login";

function setMessage(text, success = false) {
  message.textContent = text;
  message.classList.toggle("success", success);
}
function setMode(nextMode) {
  mode = nextMode;
  loginTab.classList.toggle("active", mode === "login");
  registerTab.classList.toggle("active", mode === "register");
  submitButton.textContent = mode === "login" ? "Войти" : "Создать аккаунт";
  document.getElementById("password").autocomplete = mode === "login" ? "current-password" : "new-password";
  setMessage("");
}
function showAccount(user) {
  authCard.classList.add("hidden");
  accountCard.classList.remove("hidden");
  accountEmail.textContent = user?.email || "Аккаунт Neural Messenger";
}
function showAuth() {
  accountCard.classList.add("hidden");
  authCard.classList.remove("hidden");
}

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  if (!email || password.length < 6) {
    setMessage("Укажи почту и пароль длиной не менее 6 символов.");
    return;
  }
  submitButton.disabled = true;
  submitButton.textContent = mode === "login" ? "Входим…" : "Создаём аккаунт…";
  setMessage("");
  try {
    if (mode === "register") {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) throw error;
      if (data.session) {
        showAccount(data.user);
      } else {
        setMessage("Аккаунт создан! Проверь почту и подтверди адрес, затем войди.", true);
        setMode("login");
      }
    } else {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showAccount(data.user);
    }
  } catch (error) {
    setMessage(error.message || "Не удалось выполнить запрос. Попробуй ещё раз.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = mode === "login" ? "Войти" : "Создать аккаунт";
  }
});

logoutButton.addEventListener("click", async () => {
  const { error } = await client.auth.signOut();
  if (error) {
    accountEmail.textContent = error.message;
    return;
  }
  showAuth();
  authForm.reset();
  setMode("login");
});

(async function restoreSession() {
  const { data, error } = await client.auth.getSession();
  if (error) console.error("Session restore error:", error.message);
  if (data.session?.user) showAccount(data.session.user);
})();
