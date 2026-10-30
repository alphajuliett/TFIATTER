(() => {
  "use strict";

  const POLL_INTERVAL_MS = 2000;

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const state = {
    token: localStorage.getItem("tfiatter_token"),
    me: null,
    feed: [],
    trends: [],
    currentProfile: null,
    profileTab: "tweets",
    profilePosts: [],
    composerFiles: [],
    commentFiles: [],
    quoteFiles: [],
    activePostId: null,
    activeComments: [],
    repostTarget: null,
    quoteTarget: null,
    editingPostId: null,
    editingCommentId: null,
    editAvatar: null,
    editBanner: null,
    notifications: [],
    conversations: [],
    activeConversation: null,
    activeMessages: [],
    navCounts: { notifications: 0, messages: 0 },
    admin: { overview: null, users: [], posts: [] },
    animation: { overview: null, rubric: [], targets: [], q: "", kind: "all" },
    giphy: { config: null, target: "composer", results: [], trending: null, hydrateTimer: null },
    emojiTarget: "composer",
    search: { query: "", tab: "top", people: "anyone", location: "anywhere", peopleResults: [], items: [], filters: {}, suggestionTimer: null, suggestionRequest: 0 },
    polling: { timer: null, running: false }
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[ch]);
  }

  function safeUrl(url) {
    if (!url) return "";
    try {
      const u = new URL(url, location.origin);
      return ["http:", "https:"].includes(u.protocol) ? u.href : "";
    } catch { return ""; }
  }

  function linkify(text) {
    let out = escapeHtml(text);
    out = out.replace(/(https?:\/\/[^\s<]+)/gi, raw => {
      const href = safeUrl(raw.replace(/&amp;/g, "&"));
      return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${raw}</a>` : raw;
    });
    out = out.replace(/(^|\s)(#[\p{L}\p{N}_]{2,40})/gu, '$1<a href="#" class="hashtag" data-search-tag="$2">$2</a>');
    out = out.replace(/(^|\s)@([a-z0-9_]{3,20})/gi, '$1<a href="#" data-profile="$2">@$2</a>');
    return out;
  }

  function icon(name, filled = false) {
    const common = 'class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
    const icons = {
      reply: `<svg ${common}><path d="M21 11.5a8.2 8.2 0 0 1-8.4 8.1 9.8 9.8 0 0 1-4.2-.9L3 20.2l1.55-4.45A7.8 7.8 0 0 1 3.8 12C3.8 7.5 7.55 4 12.2 4 17.1 4 21 7.35 21 11.5Z"/></svg>`,
      retweet: `<svg ${common}><path d="m7 7 3-3m-3 3 3 3M7 7h9.5A2.5 2.5 0 0 1 19 9.5V11M17 17l-3 3m3-3-3-3m3 3H7.5A2.5 2.5 0 0 1 5 14.5V13"/></svg>`,
      quote: `<svg ${common}><path d="M7 8.5h10a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H8l-4 2v-10.5a2 2 0 0 1 2-2Z"/><path d="M9 12h6m-6 3h4"/></svg>`,
      heart: filled
        ? `<svg class="ui-icon filled" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20.4 4.3 13A5.2 5.2 0 0 1 12 6.1 5.2 5.2 0 0 1 19.7 13Z"/></svg>`
        : `<svg ${common}><path d="M12 20.4 4.3 13A5.2 5.2 0 0 1 12 6.1 5.2 5.2 0 0 1 19.7 13Z"/></svg>`,
      share: `<svg ${common}><path d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5M5 12.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6.5"/></svg>`,
      paperclip: `<svg ${common}><path d="m9.3 12.7 5.9-5.9a3 3 0 1 1 4.2 4.2l-7.3 7.3a5 5 0 0 1-7.1-7.1l7-7a3.5 3.5 0 0 1 5 5l-6.7 6.7a2 2 0 0 1-2.8-2.8l6-6"/></svg>`,
      image: `<svg ${common}><rect x="3.5" y="4" width="17" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m5 17 4.5-4.5 3.2 3.2 2.2-2.2L19 17.6"/></svg>`,
      camera: `<svg ${common}><path d="M4 8h3l1.5-2h7L17 8h3v11H4Z"/><circle cx="12" cy="13" r="3.2"/></svg>`,
      smile: `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M8.3 14.3c1 1.4 2.2 2 3.7 2s2.7-.6 3.7-2"/><circle cx="9" cy="9.5" r=".7" fill="currentColor" stroke="none"/><circle cx="15" cy="9.5" r=".7" fill="currentColor" stroke="none"/></svg>`,
      poll: `<svg ${common}><path d="M5 19V9m7 10V5m7 14v-7"/></svg>`,
      location: `<svg ${common}><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>`,
      more: `<svg ${common}><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>`,
      edit: `<svg ${common}><path d="M4 20h4l10.8-10.8a2.2 2.2 0 0 0-4-1.4L4 18v2Z"/><path d="m13.5 8.5 3 3"/></svg>`,
      trash: `<svg ${common}><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>`,
      verified: `<svg class="ui-icon verified-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="m7.7 12.2 2.8 2.8 5.9-6.1"/></svg>`,
      shield: `<svg ${common}><path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>`,
      users: `<svg ${common}><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-4 2.3-6 5.5-6s5 2 5.5 6M15 6.5a2.5 2.5 0 0 1 0 5M16 13.5c2.6.4 4 2.2 4.5 5.5"/></svg>`,
      chart: `<svg ${common}><path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/></svg>`,
      home: `<svg ${common}><path d="M3.5 11.2 12 4l8.5 7.2"/><path d="M5.5 10v9.5h13V10M9.5 19.5v-6h5v6"/></svg>`,
      bell: `<svg ${common}><path d="M18 9.5c0-3.4-2.2-5.8-6-5.8s-6 2.4-6 5.8c0 5-2 6.2-2 6.2h16s-2-1.2-2-6.2Z"/><path d="M9.5 19a2.8 2.8 0 0 0 5 0"/></svg>`,
      message: `<svg ${common}><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="m5 7 7 5.5L19 7"/></svg>`,
      logout: `<svg ${common}><path d="M10 5H5v14h5M14 8l4 4-4 4m4-4H9"/></svg>`,
      send: `<svg ${common}><path d="m3.5 4.5 17 7.5-17 7.5 3-7.5-3-7.5Z"/><path d="M6.5 12h14"/></svg>`,
      close: `<svg ${common}><path d="m6 6 12 12M18 6 6 18"/></svg>`,
      search: `<svg ${common}><circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.5 15.5 4.2 4.2"/></svg>`
    };
    return icons[name] || "";
  }

  function hydrateIcons() {
    $$('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
  }

  function initials(user) {
    const name = user?.displayName || user?.username || "T";
    return name.split(/\s+/).slice(0, 2).map(x => x[0] || "").join("").toUpperCase();
  }

  function verifiedBadge(user) {
    return user?.isVerified ? `<span class="verified-badge" title="Compte officiel certifié" aria-label="Compte officiel certifié">${icon("verified")}</span>` : "";
  }

  function adminBadge(user) {
    return user?.isAdmin ? `<span class="admin-badge" title="Administrateur TFI@TTER">${icon("shield")} Admin</span>` : "";
  }

  function avatarMarkup(user, className = "avatar") {
    const url = safeUrl(user?.avatarUrl);
    return `<button class="${className} avatar ${url ? "" : "fallback"}" data-profile="${escapeHtml(user?.username || "")}" ${url ? `style="background-image:url('${escapeHtml(url)}')"` : ""}>${url ? "" : escapeHtml(initials(user))}</button>`;
  }

  function setAvatar(el, user) {
    if (!el) return;
    const raw = String(user?.avatarUrl || "");
    const url = raw.startsWith("data:image/") ? raw : safeUrl(raw);
    el.classList.toggle("fallback", !url);
    el.style.backgroundImage = url ? `url("${url.replace(/"/g, "")}")` : "";
    el.textContent = url ? "" : initials(user);
  }

  // Variante pour le rond de l'éditeur : elle conserve le <label> et l'input fichier
  // au lieu de remplacer le contenu du nœud comme setAvatar().
  function setEditableAvatar(user) {
    const el = $("#editAvatarPreview");
    if (!el) return;
    const raw = String(user?.avatarUrl || "");
    const url = raw.startsWith("data:image/") ? raw : safeUrl(raw);
    el.classList.toggle("fallback", !url);
    el.style.backgroundImage = url ? `url("${url.replace(/"/g, "")}")` : "";
  }

  function relativeDate(value) {
    const d = new Date(value);
    const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (seconds < 30) return "maintenant";
    if (seconds < 60) return `${seconds}s`;
    const min = Math.floor(seconds / 60); if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60); if (h < 24) return `${h} h`;
    const day = Math.floor(h / 24); if (day < 7) return `${day} j`;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }

  function longDate(value) {
    return new Date(value).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }

  function formatMetric(value, emptyZero = true) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return emptyZero ? "" : "0";
    if (n < 1000) return String(Math.floor(n));
    if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
    return `${(n / 1000000).toFixed(1)}M`;
  }

  function toast(message, type = "") {
    const el = $("#toast");
    el.textContent = message;
    el.className = `toast ${type}`.trim();
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.add("hidden"), 2800);
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    if (options.body && typeof options.body !== "string") {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }
    const res = await fetch(path, { ...options, headers });
    let data = {};
    try { data = await res.json(); } catch { /* no-op */ }
    if (!res.ok) {
      const authFailure = res.status === 401 || (res.status === 403 && data.error?.toLowerCase().includes("désactiv"));
      if (authFailure && state.token && !path.includes("/login")) {
        localStorage.removeItem("tfiatter_token"); state.token = null; state.me = null; refreshAuthUI();
      }
      throw new Error(data.error || `Erreur HTTP ${res.status}`);
    }
    return data;
  }

  function signature(value) {
    try { return JSON.stringify(value); } catch { return String(Date.now()); }
  }

  function panelVisible(id) {
    const el = $(`#${id}`);
    return !!el && !el.classList.contains("hidden");
  }

  function modalVisible(id) {
    const el = $(`#${id}`);
    return !!el && !el.classList.contains("hidden");
  }

  function snapshotMessageUi() {
    const thread = $("#messageThread"), textarea = $("#privateMessageForm textarea"), newUser = $("#newMessageForm input[name='username']");
    return {
      draft: textarea?.value || "",
      draftFocused: document.activeElement === textarea,
      selectionStart: textarea?.selectionStart ?? null,
      selectionEnd: textarea?.selectionEnd ?? null,
      newUser: newUser?.value || "",
      newUserFocused: document.activeElement === newUser,
      scrollTop: thread?.scrollTop || 0,
      nearBottom: thread ? (thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80) : true
    };
  }

  function restoreMessageUi(snapshot) {
    if (!snapshot) return;
    const thread = $("#messageThread"), textarea = $("#privateMessageForm textarea"), newUser = $("#newMessageForm input[name='username']");
    if (textarea) {
      textarea.value = snapshot.draft;
      if (snapshot.draftFocused) {
        textarea.focus({ preventScroll: true });
        if (snapshot.selectionStart !== null) textarea.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
      }
    }
    if (newUser) {
      newUser.value = snapshot.newUser;
      if (snapshot.newUserFocused) newUser.focus({ preventScroll: true });
    }
    if (thread && !snapshot.nearBottom) thread.scrollTop = snapshot.scrollTop;
  }

  async function pollMe() {
    if (!state.token) return;
    try {
      const data = await api("/api/me");
      if (signature(data.user) !== signature(state.me)) {
        state.me = data.user;
        refreshAuthUI();
      }
    } catch { /* l'API gère déjà les sessions invalides */ }
  }

  async function pollFeed() {
    try {
      const data = await api(`/api/feed?mode=global`), next = data.items || [];
      if (signature(next) === signature(state.feed)) return;
      state.feed = next;
      if (panelVisible("homePanel")) renderFeed();
    } catch { /* polling silencieux */ }
  }

  async function pollSuggestions() {
    if (!state.me) return;
    try {
      const { items } = await api("/api/suggestions"), next = items || [];
      const current = $$("#suggestionsList [data-follow-suggestion]").map(el => el.dataset.followSuggestion).join("|");
      const incoming = next.map(u => u.username).join("|");
      if (current === incoming) return;
      renderSuggestions(next);
    } catch { /* polling silencieux */ }
  }

  async function pollTrends() {
    try {
      const { items } = await api("/api/trends"), next = items || [];
      if (signature(next) === signature(state.trends)) return;
      state.trends = next;
      renderTrends();
    } catch { /* polling silencieux */ }
  }

  async function pollProfile() {
    if (!state.currentProfile || !panelVisible("profilePanel")) return;
    const username = state.currentProfile.username, tab = state.profileTab || "tweets";
    try {
      const [profileData, postsData] = await Promise.all([
        api(`/api/profile/${encodeURIComponent(username)}`),
        api(`/api/profile/${encodeURIComponent(username)}/posts?tab=${encodeURIComponent(tab)}`)
      ]);
      const nextProfile = profileData.user, nextPosts = postsData.items || [];
      if (signature(nextProfile) === signature(state.currentProfile) && signature(nextPosts) === signature(state.profilePosts)) return;
      state.currentProfile = nextProfile; state.profilePosts = nextPosts; renderProfilePage(nextProfile, nextPosts);
    } catch { /* polling silencieux */ }
  }

  async function pollNotifications() {
    if (!state.me || !panelVisible("notificationsPanel")) return;
    try {
      const data = await api("/api/notifications?limit=100"), next = data.items || [];
      if (signature(next) !== signature(state.notifications)) {
        state.notifications = next; renderNotifications();
      }
      if (next.some(n => !n.read)) {
        await api("/api/notifications/read", { method: "POST" });
        state.notifications.forEach(n => n.read = true); renderNotifications(); await loadNavCounts();
      }
    } catch { /* polling silencieux */ }
  }

  async function pollMessages() {
    if (!state.me || !panelVisible("messagesPanel")) return;
    try {
      const snapshot = snapshotMessageUi();
      const conversationsData = await api("/api/messages"), nextConversations = conversationsData.items || [];
      let nextActive = state.activeConversation, nextMessages = state.activeMessages;
      if (nextActive?.username) {
        const threadData = await api(`/api/messages/${encodeURIComponent(nextActive.username)}`);
        nextActive = threadData.user; nextMessages = threadData.items || [];
      }
      const changed = signature(nextConversations) !== signature(state.conversations) || signature(nextMessages) !== signature(state.activeMessages) || signature(nextActive) !== signature(state.activeConversation);
      state.conversations = nextConversations; state.activeConversation = nextActive; state.activeMessages = nextMessages;
      if (changed) { renderMessagesPage(); requestAnimationFrame(() => restoreMessageUi(snapshot)); }
    } catch { /* polling silencieux */ }
  }

  async function pollComments() {
    if (!state.activePostId || !modalVisible("commentsModal")) return;
    try {
      const data = await api(`/api/posts/${state.activePostId}/comments`);
      const post = data.post || findPost(state.activePostId);
      if (post) $("#commentsPost").innerHTML = postMarkup(post, { hideActions: true });
      const list = data.items || [];
      state.activeComments = list;
      const currentSig = $("#commentsList")?.dataset.pollSignature || "";
      const nextSig = signature(list);
      if (currentSig !== nextSig) {
        renderComments(list);
        $("#commentsList").dataset.pollSignature = nextSig;
      }
    } catch { /* polling silencieux */ }
  }

  async function pollAdmin() {
    if (!state.me?.isAdmin || !modalVisible("adminModal")) return;
    try {
      const [overview, users, posts] = await Promise.all([api("/api/admin/overview"), api("/api/admin/users"), api("/api/admin/posts?limit=60")]);
      const next = { overview: overview.stats, users: users.items || [], posts: posts.items || [], viewerId: users.viewerId };
      if (signature(next) === signature(state.admin)) return;
      const active = document.activeElement;
      if (active && $("#adminContent")?.contains(active)) return;
      state.admin = next;
      renderAdminPanel($("#adminUserSearch")?.value || "");
    } catch { /* polling silencieux */ }
  }

  async function pollAnimation() {
    if (!state.me?.isTrainer || !modalVisible("animationModal")) return;
    const active = document.activeElement;
    if (active && $("#animationContent")?.contains(active) && ["INPUT","SELECT"].includes(active.tagName)) return;
    try {
      const params = new URLSearchParams({q:state.animation.q||"",kind:state.animation.kind||"all",limit:"100"});
      const [overview,targets] = await Promise.all([api("/api/trainer/overview"),api(`/api/trainer/targets?${params.toString()}`)]);
      const next={overview:overview.stats||{},rubric:overview.rubric||[],targets:targets.items||[]};
      const current={overview:state.animation.overview||{},rubric:state.animation.rubric||[],targets:state.animation.targets||[]};
      if(signature(next)===signature(current)) return;
      state.animation.overview=next.overview; state.animation.rubric=next.rubric; state.animation.targets=next.targets; renderAnimationPanel();
    } catch { /* polling silencieux */ }
  }

  async function pollSearch() {
    if (!state.me || !panelVisible("searchPanel") || !state.search.query) return;
    try {
      const params = new URLSearchParams({ q: state.search.query, tab: state.search.tab, people: state.search.people, location: state.search.location, limit: "50" });
      const data = await api(`/api/search?${params.toString()}`);
      const next = { peopleResults: data.people || [], items: data.items || [], filters: data.filters || {} };
      const current = { peopleResults: state.search.peopleResults, items: state.search.items, filters: state.search.filters };
      if (signature(next) === signature(current)) return;
      state.search.peopleResults = next.peopleResults; state.search.items = next.items; state.search.filters = next.filters;
      renderSearchPage();
    } catch { /* polling silencieux */ }
  }

  async function pollEverything() {
    if (state.polling.running) return;
    state.polling.running = true;
    try {
      const jobs = [pollFeed(), pollTrends()];
      if (state.me) jobs.push(pollSuggestions(), pollMe(), loadNavCounts(), pollProfile(), pollNotifications(), pollMessages(), pollComments(), pollAdmin(), pollAnimation(), pollSearch());
      await Promise.allSettled(jobs);
    } finally { state.polling.running = false; }
  }

  function startPolling() {
    if (state.polling.timer) clearInterval(state.polling.timer);
    state.polling.timer = setInterval(pollEverything, POLL_INTERVAL_MS);
  }

  function requireAuth(action) {
    if (state.me) return true;
    openAuth("login"); toast(action || "Connectez-vous pour continuer."); return false;
  }

  function openAuth(tab = "login") { $("#authModal").classList.remove("hidden"); switchAuthTab(tab); }
  function closeAuth() { $("#authModal").classList.add("hidden"); }
  function switchAuthTab(tab) {
    $$('[data-auth-tab]').forEach(b => b.classList.toggle("active", b.dataset.authTab === tab));
    $("#loginForm").classList.toggle("hidden", tab !== "login");
    $("#registerForm").classList.toggle("hidden", tab !== "register");
  }

  function refreshAuthUI() {
    const logged = !!state.me;
    $("#loginButton").classList.toggle("hidden", logged);
    $("#registerTopButton")?.classList.toggle("hidden", logged);
    $("#headerAvatar").classList.toggle("hidden", !logged);
    $("#tweetButton").classList.toggle("hidden", !logged);
    $("#mainNav")?.classList.remove("hidden");
    $$(".nav-link").forEach(b => b.classList.toggle("hidden", !logged && b.dataset.nav !== "home"));
    $("#searchWrap")?.classList.toggle("hidden", !logged);
    $("#pageShell")?.classList.remove("hidden");
    $("#guestGate")?.classList.add("hidden");
    $("#composer").classList.toggle("hidden", !logged);
    $("#commentComposer").classList.toggle("hidden", !logged);
    $("#suggestionsCard")?.classList.toggle("hidden", !logged);
    if (logged) {
      setAvatar($("#headerAvatar"), state.me); setAvatar($("#composerAvatar"), state.me); renderLeftProfile();
    } else {
      $("#profileCard").className = "card profile-card guest-card";
      $("#profileCard").innerHTML = `<div class="guest-copy"><h2>Bienvenue sur TFI@TTER</h2><p>Le fil est accessible en lecture. Connectez-vous pour publier, répondre, aimer et republier.</p><button class="tweet-button wide" data-open-auth="register">S'inscrire</button><button class="outline-button wide" data-open-auth="login">Se connecter</button></div>`;
      state.currentProfile = null; state.profilePosts = [];
      state.navCounts = { notifications: 0, messages: 0 }; renderNavBadges();
    }
  }

  function renderLeftProfile() {
    const u = state.me;
    if (!u) return;
    const banner = safeUrl(u.bannerUrl);
    $("#profileCard").className = "card profile-card";
    $("#profileCard").innerHTML = `
      <div class="profile-banner" ${banner ? `style="background-image:url('${escapeHtml(banner)}')"` : ""}></div>
      <div class="profile-summary">
        ${avatarMarkup(u, "profile-card-avatar")}
        <div class="profile-ident"><strong><a href="#" data-profile="${escapeHtml(u.username)}">${escapeHtml(u.displayName)}</a></strong>${verifiedBadge(u)}<span>@${escapeHtml(u.username)}</span>${adminBadge(u)}</div>
        <div class="profile-stats">
          <button class="profile-stat" data-profile="${escapeHtml(u.username)}"><span>TFI@Ts</span><b>${u.postsCount || 0}</b></button>
          <button class="profile-stat" data-connections="following" data-connections-user="${escapeHtml(u.username)}"><span>Abonnements</span><b>${u.followingCount || 0}</b></button>
          <button class="profile-stat" data-connections="followers" data-connections-user="${escapeHtml(u.username)}"><span>Abonnés</span><b>${formatMetric(u.followersCount, false)}</b></button>
        </div>
        ${u.isTrainer ? `<button class="animation-entry" data-open-animation>${icon("chart")} <span>Panneau Animation</span></button>` : ""}
        ${u.isAdmin ? `<button class="admin-entry" data-open-admin>${icon("shield")} <span>Panneau d'administration</span></button>` : ""}
        <button class="logout-entry" data-logout>${icon("logout")} <span>Se déconnecter</span></button>
      </div>`;
  }

  function giphyIdFromMedia(media) {
    if (!media) return "";
    if (media.mimeType === "image/giphy" && String(media.url || "").startsWith("giphy:")) return String(media.url).slice(6);
    return "";
  }

  function mediaMarkup(media = []) {
    if (!media.length) return "";
    const items = media.map(m => {
      const giphyId = giphyIdFromMedia(m);
      const name = escapeHtml(m.name || "fichier");
      if (giphyId) {
        return `<div class="giphy-media media-clickable" data-giphy-id="${escapeHtml(giphyId)}" data-giphy-name="${name}" data-media-open="1" data-media-type="image" data-media-name="${name}" role="button" tabindex="0"><div class="giphy-placeholder"><span>GIF</span><small>GIPHY</small></div></div>`;
      }
      const url = escapeHtml(safeUrl(m.url) || m.url);
      if (m.mimeType?.startsWith("image/")) return `<div class="media-frame media-clickable" data-media-open="1" data-media-type="image" data-media-src="${url}" data-media-name="${name}" role="button" tabindex="0"><img src="${url}" alt="${name}" loading="lazy"></div>`;
      if (m.mimeType?.startsWith("video/")) return `<div class="media-frame media-clickable" data-media-open="1" data-media-type="video" data-media-src="${url}" data-media-name="${name}" role="button" tabindex="0"><video src="${url}" muted preload="metadata" playsinline></video><span class="media-play-overlay">▶</span></div>`;
      if (m.mimeType === "application/pdf") return `<button class="pdf-card media-frame media-clickable" type="button" data-media-open="1" data-media-type="pdf" data-media-src="${url}" data-media-name="${name}"><span class="pdf-icon">PDF</span><span><b>${name}</b><small>Afficher le document</small></span></button>`;
      return "";
    }).join("");
    setTimeout(scheduleGiphyHydration, 0);
    return `<div class="post-media count-${Math.min(media.length,4)}">${items}</div>`;
  }

  function closeMediaModal() {
    const modal = $("#mediaModal"); if (!modal) return;
    modal.classList.add("hidden");
    $("#mediaModalContent").innerHTML = "";
    $("#mediaModalCaption").textContent = "";
  }

  function openMediaModal(trigger) {
    if (!trigger) return;
    const type = trigger.dataset.mediaType || "image";
    const src = safeUrl(trigger.dataset.mediaSrc || "");
    const name = trigger.dataset.mediaName || "Média";
    if (!src) return toast("Ce média n’est pas encore disponible.", "error");
    let html = "";
    if (type === "video") html = `<video src="${escapeHtml(src)}" controls autoplay playsinline></video>`;
    else if (type === "pdf") html = `<iframe src="${escapeHtml(src)}" title="${escapeHtml(name)}"></iframe>`;
    else html = `<img src="${escapeHtml(src)}" alt="${escapeHtml(name)}">`;
    $("#mediaModalContent").innerHTML = html;
    $("#mediaModalCaption").textContent = name;
    $("#mediaModal").classList.remove("hidden");
  }

  function quoteCardMarkup(quote) {
    if (!quote) return "";
    const item = quote.type === "comment" ? quote.comment : quote.post;
    if (!item?.author) return `<div class="quote-card quote-missing">Ce contenu cité n’est plus disponible.</div>`;
    const openId = quote.type === "comment" ? item.parentPostId : item.id;
    const context = quote.type === "comment" ? `<div class="quote-context">Réponse à @${escapeHtml(item.replyingTo?.username || "utilisateur")}</div>` : "";
    return `<div class="quote-card" data-open-conversation="${escapeHtml(openId)}">
      <div class="quote-head"><strong>${escapeHtml(item.author.displayName)}</strong>${verifiedBadge(item.author)}<span>@${escapeHtml(item.author.username)} · ${relativeDate(item.createdAt)}</span></div>
      ${context}<div class="quote-content">${linkify(item.content || "")}</div>${mediaMarkup(item.media || [])}
    </div>`;
  }

  function postMarkup(post, options = {}) {
    if (!post?.author) return "";
    const retweet = post.retweetedBy;
    const mine = Boolean(post.ownedByMe) || (state.me && Number(state.me.id) === Number(post.author.id));
    const edited = post.edited ? `<span class="edited-label" title="Modifié le ${escapeHtml(new Date(post.editedAt).toLocaleString("fr-FR"))}">Modifié</span>` : "";
    const menu = mine && !options.hideActions ? `<div class="post-menu-wrap">
      <button class="post-menu" data-action="menu" data-id="${post.id}" title="Plus">${icon("more")}</button>
      <div class="post-dropdown hidden" data-menu-for="${post.id}">
        <button data-action="edit" data-id="${post.id}">${icon("edit")} Modifier</button>
        <button class="danger" data-action="delete" data-id="${post.id}">${icon("trash")} Supprimer</button>
      </div></div>` : `<button class="post-menu" data-action="share" data-id="${post.id}" title="Plus">${icon("more")}</button>`;

    return `${retweet ? `<div class="retweet-note">${icon("retweet")} <a href="#" data-profile="${escapeHtml(retweet.username)}">${escapeHtml(retweet.displayName || `@${retweet.username}`)}</a> a retweeté</div>` : ""}
      <article class="post ${post.isTrainerPost ? "trainer-post" : ""}" data-post-id="${post.id}">
        ${avatarMarkup(post.author, "post-avatar")}
        <div class="post-main">
          <div class="post-head">
            <strong><a href="#" data-profile="${escapeHtml(post.author.username)}">${escapeHtml(post.author.displayName)}</a></strong>
            ${verifiedBadge(post.author)}
            ${post.author.isAdmin ? `<span class="mini-admin" title="Administrateur">${icon("shield")}</span>` : ""}
            <span class="handle">@${escapeHtml(post.author.username)}</span>${edited}
            <span class="time" title="${escapeHtml(new Date(post.createdAt).toLocaleString("fr-FR"))}">${relativeDate(post.eventAt || post.createdAt)}</span>${menu}
          </div>
          <div class="post-content">${linkify(post.content || "")}</div>
          ${mediaMarkup(post.media)}
          ${quoteCardMarkup(post.quote)}
          ${options.hideActions ? "" : `<div class="post-actions">
            <button class="action-button reply-action" data-action="comments" data-id="${post.id}" title="Répondre">${icon("reply")}<span>${formatMetric(post.commentCount)}</span></button>
            <button class="action-button retweet-action ${post.retweetedByMe ? "retweeted" : ""}" data-action="repost-menu" data-kind="post" data-id="${post.id}" title="Republier ou citer">${icon("retweet")}<span>${formatMetric(post.retweetCount)}</span></button>
            <button class="action-button like-action ${post.likedByMe ? "liked" : ""}" data-action="like" data-id="${post.id}" title="J'aime">${icon("heart", post.likedByMe)}<span>${formatMetric(post.likeCount)}</span></button>
            <button class="action-button share-action" data-action="share" data-id="${post.id}" title="Partager">${icon("share")}</button>
          </div>`}
        </div>
      </article>`;
  }

  function renderFeed() {
    const feed = $("#feed");
    if (!state.feed.length) {
      feed.innerHTML = `<div class="empty-state"><h3>Aucun TFI@T pour l'instant</h3><p>${state.me ? "Suivez des comptes ou publiez le premier message." : "Créez un compte et lancez la conversation."}</p></div>`; return;
    }
    feed.innerHTML = state.feed.map(p => profileEntryMarkup(p)).join("");
  }

  async function loadFeed() {
    $("#feed").innerHTML = `<div class="loading">Chargement du fil…</div>`;
    try { const data = await api(`/api/feed?mode=global`); state.feed = data.items || []; renderFeed(); }
    catch (e) { $("#feed").innerHTML = `<div class="empty-state"><h3>Impossible de charger le fil</h3><p>${escapeHtml(e.message)}</p></div>`; }
  }

  function renderNavBadges() {
    const pairs = [["notificationBadge", state.navCounts.notifications], ["messageBadge", state.navCounts.messages]];
    for (const [id, value] of pairs) {
      const el = $(`#${id}`); if (!el) continue;
      const n = Number(value || 0); el.textContent = n > 99 ? "99+" : String(n); el.classList.toggle("hidden", n < 1);
    }
  }

  async function loadNavCounts() {
    if (!state.me) { state.navCounts = { notifications: 0, messages: 0 }; renderNavBadges(); return; }
    try { state.navCounts = await api("/api/nav-counts"); renderNavBadges(); } catch { /* non bloquant */ }
  }

  function setNavActive(name) {
    $$(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.nav === name));
  }

  function showCenter(panelId) {
    ["homePanel","profilePanel","notificationsPanel","messagesPanel","searchPanel"].forEach(id => $(`#${id}`)?.classList.toggle("hidden", id !== panelId));
    const searching = panelId === "searchPanel";
    $("#suggestionsCard")?.classList.toggle("hidden", searching);
    $("#trendsCard")?.classList.toggle("hidden", searching);
    $("#searchFiltersCard")?.classList.toggle("hidden", !searching);
  }

  function notificationCopy(n) {
    const label = { like: "a aimé votre TFI@T", retweet: "a republié votre TFI@T", comment: "a répondu à votre TFI@T", follow: "s’est abonné à votre profil", comment_like: "a aimé votre réponse", comment_retweet: "a republié votre réponse", quote: "a cité votre contenu" }[n.type] || "a interagi avec votre compte";
    return label;
  }

  function renderNotifications() {
    const panel = $("#notificationsPanel");
    panel.innerHTML = `<div class="timeline-title page-title"><strong>Notifications</strong><button class="plain-button" data-mark-notifications>Tout marquer comme lu</button></div>
      <div class="notifications-list">${state.notifications.length ? state.notifications.map(n => `<article class="notification-row ${n.read ? "" : "unread"}">
        <div class="notification-kind ${escapeHtml(n.type)}">${(["like","comment_like"].includes(n.type)) ? icon("heart", true) : (["retweet","comment_retweet"].includes(n.type)) ? icon("retweet") : n.type === "quote" ? icon("quote") : n.type === "comment" ? icon("reply") : icon("users")}</div>
        ${avatarMarkup(n.actor, "notification-avatar")}
        <div class="notification-main"><div><strong><a href="#" data-profile="${escapeHtml(n.actor.username)}">${escapeHtml(n.actor.displayName)}</a></strong>${verifiedBadge(n.actor)} <span>${notificationCopy(n)}</span></div>
        ${n.postSnippet ? `<p>${escapeHtml(n.postSnippet)}</p>` : ""}<time>${relativeDate(n.createdAt)}</time></div>
      </article>`).join("") : `<div class="empty-state"><h3>Aucune notification</h3><p>Les likes, republications, citations, réponses et nouveaux abonnements apparaîtront ici.</p></div>`}</div>`;
  }

  async function openNotifications() {
    if (!requireAuth("Connectez-vous pour voir vos notifications.")) return;
    showCenter("notificationsPanel"); setNavActive("notifications"); state.currentProfile = null;
    $("#notificationsPanel").innerHTML = `<div class="loading">Chargement des notifications…</div>`;
    try {
      const data = await api("/api/notifications?limit=100"); state.notifications = data.items || []; renderNotifications();
      await api("/api/notifications/read", { method: "POST" });
      state.notifications.forEach(n => n.read = true); renderNotifications(); await loadNavCounts();
    } catch (e) { $("#notificationsPanel").innerHTML = `<div class="empty-state"><h3>Notifications indisponibles</h3><p>${escapeHtml(e.message)}</p></div>`; }
  }

  function renderMessagesPage() {
    const panel = $("#messagesPanel");
    const active = state.activeConversation;
    panel.innerHTML = `<div class="messages-page">
      <aside class="conversation-column">
        <div class="messages-heading"><strong>Messages</strong></div>
        <form id="newMessageForm" class="new-message-form"><input name="username" placeholder="@utilisateur" autocomplete="off" required><button title="Nouvelle conversation">+</button></form>
        <div class="conversation-list">${state.conversations.length ? state.conversations.map(c => `<div class="conversation-item ${active?.username === c.user.username ? "active" : ""}" data-message-user="${escapeHtml(c.user.username)}" role="button" tabindex="0">
          ${avatarMarkup(c.user, "conversation-avatar")}<span class="conversation-copy"><b>${escapeHtml(c.user.displayName)} ${verifiedBadge(c.user)}</b><small>@${escapeHtml(c.user.username)} · ${relativeDate(c.lastAt)}</small><em>${escapeHtml((c.lastMessage || "").slice(0,72))}</em></span>${c.unreadCount ? `<span class="conversation-unread">${c.unreadCount}</span>` : ""}<button class="conversation-delete" data-delete-conversation="${escapeHtml(c.user.username)}" title="Supprimer la discussion" aria-label="Supprimer la discussion avec @${escapeHtml(c.user.username)}">${icon("trash")}</button>
        </div>`).join("") : `<div class="empty-conversations">Aucune conversation pour l’instant.</div>`}</div>
      </aside>
      <section class="message-thread-column">${active ? `<div class="thread-header">${avatarMarkup(active, "thread-avatar")}<div><strong>${escapeHtml(active.displayName)} ${verifiedBadge(active)}</strong><span>@${escapeHtml(active.username)}</span></div><button class="thread-delete-button" data-delete-conversation="${escapeHtml(active.username)}" title="Supprimer cette discussion">${icon("trash")}</button></div>
        <div id="messageThread" class="message-thread">${state.activeMessages.length ? state.activeMessages.map(m => `<div class="message-bubble-row ${m.mine ? "mine" : "theirs"}"><div class="message-bubble">${linkify(m.content)}<time>${relativeDate(m.createdAt)}</time></div></div>`).join("") : `<div class="thread-empty">Commencez la conversation.</div>`}</div>
        <form id="privateMessageForm" class="private-message-form"><textarea name="content" rows="2" placeholder="Écrire un message" required></textarea><button class="tweet-button" title="Envoyer">${icon("send")}</button></form>` : `<div class="message-placeholder">${icon("message")}<h3>Vos messages</h3><p>Sélectionnez une conversation ou saisissez un @identifiant.</p></div>`}</section>
    </div>`;
    requestAnimationFrame(() => { const t = $("#messageThread"); if (t) t.scrollTop = t.scrollHeight; });
  }

  async function loadConversations() {
    const data = await api("/api/messages"); state.conversations = data.items || [];
  }

  async function openMessageThread(username) {
    username = String(username || "").trim().replace(/^@/, ""); if (!username) return;
    try {
      const data = await api(`/api/messages/${encodeURIComponent(username)}`); state.activeConversation = data.user; state.activeMessages = data.items || [];
      await loadConversations(); renderMessagesPage(); await loadNavCounts();
    } catch (e) { toast(e.message, "error"); }
  }

  async function openMessages(username = null) {
    if (!requireAuth("Connectez-vous pour accéder aux messages privés.")) return;
    showCenter("messagesPanel"); setNavActive("messages"); state.currentProfile = null;
    $("#messagesPanel").innerHTML = `<div class="loading">Chargement des messages…</div>`;
    try {
      await loadConversations();
      if (username) return openMessageThread(username);
      if (!state.activeConversation && state.conversations[0]) {
        const data = await api(`/api/messages/${encodeURIComponent(state.conversations[0].user.username)}`); state.activeConversation = data.user; state.activeMessages = data.items || []; await loadConversations();
      }
      renderMessagesPage(); await loadNavCounts();
    } catch (e) { $("#messagesPanel").innerHTML = `<div class="empty-state"><h3>Messages indisponibles</h3><p>${escapeHtml(e.message)}</p></div>`; }
  }

  async function deleteMessageConversation(username) {
    username = String(username || "").trim().replace(/^@/, "");
    if (!username) return;
    const conversation = state.conversations.find(c => c.user.username === username);
    const label = conversation?.user?.displayName ? `${conversation.user.displayName} (@${username})` : `@${username}`;
    if (!window.confirm(`Supprimer la discussion avec ${label} ?\n\nElle disparaîtra uniquement de votre messagerie. L’autre participant conservera son historique. Un nouveau message fera réapparaître la conversation.`)) return;
    try {
      await api(`/api/messages/${encodeURIComponent(username)}`, { method: "DELETE" });
      state.conversations = state.conversations.filter(c => c.user.username !== username);
      if (state.activeConversation?.username === username) {
        state.activeConversation = null; state.activeMessages = [];
      }
      renderMessagesPage();
      await loadNavCounts();
      toast("Discussion supprimée de votre messagerie.", "success");
    } catch (e) { toast(e.message, "error"); }
  }

  async function sendPrivateMessage(form) {
    if (!state.activeConversation) return;
    const textarea = form.elements.content, content = textarea.value.trim(); if (!content) return;
    const button = form.querySelector("button"); button.disabled = true;
    try {
      const data = await api(`/api/messages/${encodeURIComponent(state.activeConversation.username)}`, { method: "POST", body: { content } });
      state.activeMessages.push(data.message); textarea.value = ""; await loadConversations(); renderMessagesPage();
    } catch (e) { toast(e.message, "error"); } finally { button.disabled = false; }
  }

  function logout() {
    localStorage.removeItem("tfiatter_token");
    state.token = null; state.me = null; state.feed = []; state.trends = []; state.notifications = []; state.conversations = []; state.activeConversation = null; state.activeMessages = []; state.currentProfile = null; state.profilePosts = [];
    state.search = { ...state.search, query: "", tab: "top", people: "anyone", location: "anywhere", peopleResults: [], items: [], filters: {} };
    ["commentsModal","editPostModal","editCommentModal","editProfileModal","animationModal","adminModal","connectionsModal","repostModal","quoteModal","gifModal","mediaModal"].forEach(id => $("#"+id)?.classList.add("hidden"));
    refreshAuthUI(); home(); loadFeed(); loadTrends();
    toast("Vous êtes déconnecté. Le fil reste accessible en lecture.", "success");
  }

  function renderSuggestions(items = []) {
    $("#suggestionsList").innerHTML = items.map(u => `<div class="suggestion">${avatarMarkup(u)}<div class="suggestion-main"><div class="suggestion-name"><strong><a href="#" data-profile="${escapeHtml(u.username)}">${escapeHtml(u.displayName)}</a></strong>${verifiedBadge(u)}${u.isAdmin ? `<span class="mini-admin">${icon("shield")}</span>` : ""}<span>@${escapeHtml(u.username)}</span></div><button class="outline-button" data-follow-suggestion="${escapeHtml(u.username)}">Suivre</button></div></div>`).join("") || `<div class="loading-small">Aucune suggestion.</div>`;
  }

  async function loadSuggestions() {
    if (!state.me) return;
    try { const { items } = await api("/api/suggestions"); renderSuggestions(items || []); }
    catch { $("#suggestionsList").innerHTML = ""; }
  }

  function renderTrends() {
    const items = state.trends || [];
    $("#trendsList").innerHTML = items.length ? items.map((t, i) => `<div class="trend-item"><button data-search-tag="${escapeHtml(t.name)}"><span class="trend-rank">${i + 1} · Tendance</span><b>${escapeHtml(t.name)}</b><span>${Number(t.count || 0).toLocaleString("fr-FR")} occurrence${Number(t.count || 0) > 1 ? "s" : ""}</span></button></div>`).join("") : `<div class="loading-small">Aucun hashtag tendance pour l’instant.</div>`;
  }

  async function loadTrends() {
    try { const { items } = await api("/api/trends"); state.trends = items || []; renderTrends(); }
    catch { $("#trendsList").innerHTML = `<div class="loading-small">Tendances indisponibles.</div>`; }
  }

  async function loadMe() {
    if (!state.token) { state.me = null; refreshAuthUI(); return; }
    try { const data = await api("/api/me"); state.me = data.user; }
    catch { state.token = null; state.me = null; localStorage.removeItem("tfiatter_token"); }
    refreshAuthUI(); if (state.me) await loadNavCounts();
  }

  const EMOJI_CATEGORIES = {
    "😀": ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥳","🤩","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🫡","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪"],
    "👋": ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💪","🦾","🖕","💅","🤳"],
    "❤️": ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","❣️","💕","💞","💓","💗","💖","💘","💝","💟","💯","💢","💥","💫","💦","💨","🕳️","💬","👁️‍🗨️","🗨️","🗯️","💭","💤"],
    "🐶": ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪲","🐛","🦋","🐌","🐞","🐜","🕷️","🐢","🐍","🦎","🐙","🦑","🦀","🐠","🐟","🐡","🐬","🐳","🦈"],
    "🍕": ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🥑","🥦","🌽","🥕","🥐","🥖","🥨","🧀","🥚","🍳","🥞","🧇","🥓","🍔","🍟","🍕","🌭","🥪","🌮","🌯","🥗","🍝","🍜","🍣","🍤","🍦","🍩","🍪","🎂","🍰","🍫","🍿","☕","🍺","🍷","🥂"],
    "⚽": ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🏓","🏸","🥅","🏒","🏑","🥍","🏏","⛳","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥌","🎿","⛷️","🏂","🪂","🏋️","🤼","🤸","⛹️","🤺","🏇","🧘","🎮","🎲","🧩","🎯","🎳","🎸","🎹","🎤","🎧","🎬","🎨"],
    "🚗": ["🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🏍️","🛵","🚲","🛴","🚨","🚔","🚍","🚘","🚖","✈️","🛫","🛬","🚀","🛸","🚁","⛵","🚤","🛳️","🚆","🚇","🚄","🚅","🚉","🗺️","🗿","🗼","🏰","🏯","🏟️","🎡","🌋","🏖️","🏜️","🌅","🌆","🌃","🌌"],
    "💡": ["⌚","📱","💻","⌨️","🖥️","🖨️","🖱️","🕹️","💽","💾","💿","📷","📸","📹","🎥","📞","☎️","📺","📻","🎙️","⏱️","⏰","⌛","🔋","🔌","💡","🔦","🕯️","🧯","💸","💵","💳","💎","⚖️","🔧","🔨","⚒️","🛠️","⛏️","🔩","⚙️","⛓️","🔫","🧲","🧪","🧬","🔬","🔭","📡","💉","💊","🩹","🔑","🗝️","🚪","🪑","🛏️","🎁","🎈"],
    "🏳️": ["🇫🇷","🇪🇺","🇺🇸","🇬🇧","🇩🇪","🇮🇹","🇪🇸","🇵🇹","🇧🇪","🇨🇭","🇨🇦","🇯🇵","🇨🇳","🇮🇳","🇧🇷","🇲🇽","🇦🇺","🇳🇿","🇺🇦","🇵🇱","🇸🇪","🇳🇴","🇫🇮","🇩🇰","🇬🇷","🇹🇷","🇲🇦","🇩🇿","🇹🇳","🇸🇳","🇲🇱","🇳🇪","🇧🇫","🇨🇮","🇿🇦","🇰🇪","🇳🇬","🇪🇬","🇸🇦","🇦🇪","🇮🇱","🇵🇸","🇱🇧","🇯🇴","🇮🇷","🇮🇶","🇦🇫","🇵🇰","🏳️","🏴","🏁","🚩"]
  };

  function composerTarget(kind) {
    if (kind === "comment") return { textarea: $("#commentText"), mediaKey: "commentFiles" };
    if (kind === "quote") return { textarea: $("#quoteText"), mediaKey: "quoteFiles" };
    return { textarea: $("#composerText"), mediaKey: "composerFiles" };
  }

  function insertAtCursor(textarea, text) {
    if (!textarea) return;
    const start = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : textarea.value.length;
    const end = Number.isInteger(textarea.selectionEnd) ? textarea.selectionEnd : start;
    textarea.setRangeText(text, start, end, "end");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  }

  function renderEmojiPicker(category = Object.keys(EMOJI_CATEGORIES)[0]) {
    $("#emojiTabs").innerHTML = Object.keys(EMOJI_CATEGORIES).map(key => `<button class="${key === category ? "active" : ""}" data-emoji-category="${escapeHtml(key)}">${key}</button>`).join("");
    $("#emojiGrid").innerHTML = EMOJI_CATEGORIES[category].map(emoji => `<button data-emoji="${escapeHtml(emoji)}" title="${escapeHtml(emoji)}">${emoji}</button>`).join("");
  }

  function openEmojiPicker(target, anchorEl) {
    state.emojiTarget = ["comment","quote"].includes(target) ? target : "composer";
    renderEmojiPicker();
    const pop = $("#emojiPopover");
    pop.classList.remove("hidden");
    const rect = anchorEl.getBoundingClientRect();
    const width = 330, height = 300;
    let left = Math.min(window.innerWidth - width - 10, Math.max(10, rect.left));
    let top = rect.bottom + 7;
    if (top + height > window.innerHeight - 10) top = Math.max(10, rect.top - height - 7);
    pop.style.left = `${left}px`; pop.style.top = `${top}px`;
  }

  function closeEmojiPicker() { $("#emojiPopover")?.classList.add("hidden"); }

  async function loadGiphyConfig() {
    try { state.giphy.config = await api("/api/config/giphy"); }
    catch { state.giphy.config = { enabled: false, apiKey: "", rating: "pg-13", lang: "fr" }; }
  }

  async function giphyRequest(endpoint, params = {}) {
    const cfg = state.giphy.config;
    if (!cfg?.enabled || !cfg.apiKey) throw new Error("GIPHY n’est pas configuré. Ajoutez GIPHY_WEB_API_KEY dans le fichier .env puis reconstruisez le conteneur Node-RED.");
    const url = new URL(endpoint ? `https://api.giphy.com/v1/gifs/${endpoint}` : "https://api.giphy.com/v1/gifs");
    const values = { api_key: cfg.apiKey, rating: cfg.rating || "pg-13", ...params };
    if (cfg.lang && endpoint === "search") values.lang = cfg.lang;
    Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value)); });
    const response = await fetch(url.toString(), { method: "GET", mode: "cors", credentials: "omit" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || (payload.meta?.status && Number(payload.meta.status) >= 400)) throw new Error(payload.meta?.msg || `Erreur GIPHY ${response.status}`);
    return payload;
  }

  function giphyPreviewUrl(gif) {
    return gif?.images?.fixed_width?.webp || gif?.images?.fixed_width?.url || gif?.images?.fixed_height?.url || "";
  }

  function giphyDisplayUrl(gif) {
    return gif?.images?.downsized_medium?.url || gif?.images?.fixed_width?.url || gif?.images?.original?.url || "";
  }

  function renderGiphyResults(items, query = "") {
    state.giphy.results = items || [];
    $("#gifStatus").textContent = items?.length ? (query ? `${items.length} résultats pour « ${query} »` : "GIF populaires") : "Aucun GIF trouvé.";
    $("#gifGrid").innerHTML = (items || []).map((gif, i) => {
      const url = giphyPreviewUrl(gif);
      return url ? `<button class="gif-result" data-giphy-result="${i}" title="${escapeHtml(gif.title || "GIF GIPHY")}"><img src="${escapeHtml(url)}" alt="${escapeHtml(gif.title || "GIF")}" loading="lazy"></button>` : "";
    }).join("");
  }

  async function loadGiphyResults(query = "") {
    $("#gifStatus").textContent = query ? "Recherche…" : "Chargement des GIF populaires…";
    $("#gifGrid").innerHTML = "";
    try {
      if (!query && state.giphy.trending) return renderGiphyResults(state.giphy.trending, "");
      const payload = await giphyRequest(query ? "search" : "trending", query ? { q: query.slice(0, 50), limit: 24 } : { limit: 24 });
      if (!query) state.giphy.trending = payload.data || [];
      renderGiphyResults(payload.data || [], query);
    } catch (e) {
      $("#gifStatus").innerHTML = `<strong>GIF indisponibles</strong><span>${escapeHtml(e.message)}</span>`;
    }
  }

  async function openGifPicker(target) {
    if (!state.giphy.config) await loadGiphyConfig();
    state.giphy.target = ["comment","quote"].includes(target) ? target : "composer";
    $("#gifSearchInput").value = "";
    $("#gifModal").classList.remove("hidden");
    await loadGiphyResults("");
    $("#gifSearchInput").focus();
  }

  function closeGifPicker() { $("#gifModal")?.classList.add("hidden"); }

  function giphyAnalytics(gif, action) {
    const url = gif?.analytics?.[action]?.url;
    if (!url) return;
    try { fetch(url, { method: "GET", mode: "no-cors", credentials: "omit", keepalive: true }).catch(() => {}); } catch { /* analytics best effort */ }
  }

  function addGiphyResult(index) {
    const gif = state.giphy.results[Number(index)];
    if (!gif?.id) return;
    const target = composerTarget(state.giphy.target);
    if ((state[target.mediaKey] || []).length >= 4) return toast("Maximum 4 médias par publication ou réponse.", "error");
    const item = { provider: "giphy", providerId: gif.id, name: gif.title || "GIF GIPHY", type: "image/giphy", previewUrl: giphyPreviewUrl(gif), analytics: gif.analytics || null };
    state[target.mediaKey].push(item);
    giphyAnalytics(gif, "onclick");
    renderFilePreview(target.mediaKey);
    closeGifPicker();
  }

  function mediaForApi(items) {
    return (items || []).map(item => item?.provider === "giphy" ? { provider: "giphy", providerId: item.providerId, name: item.name || "GIF GIPHY" } : item);
  }

  function registerGiphySent(items) {
    (items || []).filter(x => x?.provider === "giphy" && x.analytics?.onsent?.url).forEach(x => {
      try { fetch(x.analytics.onsent.url, { method: "GET", mode: "no-cors", credentials: "omit", keepalive: true }).catch(() => {}); } catch { /* best effort */ }
    });
  }

  function scheduleGiphyHydration() {
    clearTimeout(state.giphy.hydrateTimer);
    state.giphy.hydrateTimer = setTimeout(hydrateGiphyMedia, 60);
  }

  async function hydrateGiphyMedia() {
    const nodes = $$(".giphy-media[data-giphy-id]:not([data-giphy-ready])");
    if (!nodes.length) return;
    if (!state.giphy.config) await loadGiphyConfig();
    if (!state.giphy.config?.enabled) {
      nodes.forEach(node => { node.dataset.giphyReady = "1"; node.innerHTML = `<div class="giphy-placeholder"><span>GIF</span><small>Clé GIPHY requise</small></div>`; });
      return;
    }
    const ids = [...new Set(nodes.map(n => n.dataset.giphyId).filter(Boolean))].slice(0, 100);
    try {
      const payload = await giphyRequest("", { ids: ids.join(",") });
      const byId = new Map((payload.data || []).map(gif => [gif.id, giphyDisplayUrl(gif)]));
      nodes.forEach(node => {
        const url = byId.get(node.dataset.giphyId);
        if (!url) return;
        node.dataset.giphyReady = "1";
        node.dataset.mediaSrc = url;
        node.innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(node.dataset.giphyName || "GIF GIPHY")}" loading="lazy">`;
      });
    } catch { /* le placeholder reste affiché si GIPHY est temporairement indisponible */ }
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, type: file.type || "application/octet-stream", data: reader.result });
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  }

  async function filesFromInput(input, target) {
    const files = [...input.files];
    const keepGiphy = (state[target] || []).filter(item => item?.provider === "giphy");
    if (files.length + keepGiphy.length > 4) { toast("Maximum 4 médias, GIF compris.", "error"); input.value = ""; return; }
    const max = 25 * 1024 * 1024;
    if (files.some(f => f.size > max)) { toast("Un fichier dépasse 25 Mo.", "error"); input.value = ""; return; }
    try { state[target] = [...keepGiphy, ...(await Promise.all(files.map(readFile)))]; renderFilePreview(target); }
    catch { toast("Impossible de lire le fichier.", "error"); }
  }

  function renderFilePreview(target) {
    const previewSelector = target === "commentFiles" ? "#commentPreview" : target === "quoteFiles" ? "#quotePreview" : "#composerPreview";
    const container = $(previewSelector), files = state[target] || [];
    if (!container) return;
    container.innerHTML = files.map((f, i) => {
      let thumb = `<span class="pdf-thumb">PDF</span>`;
      if (f.provider === "giphy") thumb = f.previewUrl ? `<img src="${escapeHtml(f.previewUrl)}" alt="GIF GIPHY">` : `<span class="gif-thumb">GIF</span>`;
      else if (f.type?.startsWith("image/")) thumb = `<img src="${escapeHtml(f.data)}" alt="">`;
      else if (f.type?.startsWith("video/")) thumb = `<video src="${escapeHtml(f.data)}"></video>`;
      return `<div class="preview-chip ${f.provider === "giphy" ? "giphy-preview-chip" : ""}">${thumb}<span>${escapeHtml(f.name || "GIF GIPHY")}</span><button data-remove-file="${i}" data-file-target="${target}">×</button></div>`;
    }).join("");
  }

  async function sendPost() {
    if (!requireAuth()) return;
    const content = $("#composerText").value.trim();
    if (!content && !state.composerFiles.length) return toast("Votre TFI@T est vide.", "error");
    const btn = $("#sendPost"); btn.disabled = true;
    try {
      const sentMedia = [...state.composerFiles];
      await api("/api/posts", { method: "POST", body: { content, media: mediaForApi(sentMedia) } });
      registerGiphySent(sentMedia);
      $("#composerText").value = ""; state.composerFiles = []; $("#composerFiles").value = ""; renderFilePreview("composerFiles");
      toast("TFI@T publié.", "success"); await Promise.all([loadMe(), loadFeed()]);
    } catch (e) { toast(e.message, "error"); } finally { btn.disabled = false; }
  }

  function findPost(id) {
    const n = Number(id);
    const direct = [...state.feed, ...state.profilePosts, ...state.search.items].find(p => p?.entryType !== "reply" && Number(p.id) === n);
    if (direct) return direct;
    const reply = state.profilePosts.find(p => p?.entryType === "reply" && Number(p.parentPostId) === n && p.parentPost);
    return reply?.parentPost || null;
  }

  function findComment(id) {
    const n = Number(id);
    const candidates = [...state.activeComments, ...state.feed, ...state.profilePosts, ...state.search.items];
    return candidates.find(c => (c?.entryType === "reply" ? Number(c.replyId) : Number(c?.id)) === n && (c?.entryType === "reply" || c?.parentPostId)) || null;
  }

  function replacePost(updated) {
    const apply = arr => arr.forEach((p, i) => {
      if (Number(p.id) === Number(updated.id)) arr[i] = { ...p, ...updated, eventAt: p.eventAt, retweetedBy: p.retweetedBy };
    });
    apply(state.feed); apply(state.profilePosts); apply(state.search.items);
  }

  function removePostFromState(id) {
    const n = Number(id);
    state.feed = state.feed.filter(p => Number(p.id) !== n);
    state.profilePosts = state.profilePosts.filter(p => Number(p.id) !== n);
    state.search.items = state.search.items.filter(p => Number(p.id) !== n && Number(p.parentPostId) !== n);
  }

  async function toggleLike(id) {
    if (!requireAuth("Connectez-vous pour aimer un TFI@T.")) return;
    try {
      const data = await api(`/api/posts/${id}/like`, { method: "POST" });
      [...state.feed, ...state.profilePosts, ...state.search.items].filter(p => p?.entryType !== "reply" && Number(p.id) === Number(id)).forEach(p => { p.likedByMe = data.liked; p.likeCount = data.count; });
      renderFeed();
      if (state.currentProfile) {
        if (state.profileTab === "likes" && state.me?.username === state.currentProfile.username && !data.liked) {
          state.profilePosts = state.profilePosts.filter(p => Number(p.id) !== Number(id));
        }
        renderProfilePage(state.currentProfile, state.profilePosts);
      }
      if (panelVisible("searchPanel")) renderSearchPage();
    } catch (e) { toast(e.message, "error"); }
  }

  async function toggleCommentLike(id) {
    if (!requireAuth("Connectez-vous pour aimer une réponse.")) return;
    try {
      const data = await api(`/api/comments/${id}/like`, { method:"POST" });
      const apply = arr => (arr || []).forEach(c => {
        const cid = c?.entryType === "reply" ? Number(c.replyId) : Number(c?.id);
        if (cid === Number(id) && (c?.entryType === "reply" || c?.parentPostId)) { c.likedByMe=data.liked; c.likeCount=data.count; }
      });
      apply(state.activeComments); apply(state.feed); apply(state.profilePosts); apply(state.search.items);
      if (state.currentProfile && state.profileTab === "likes" && state.me?.username === state.currentProfile.username && !data.liked) {
        state.profilePosts = state.profilePosts.filter(c => !(c?.entryType === "reply" && Number(c.replyId) === Number(id)));
      }
      renderFeed(); if (state.currentProfile) renderProfilePage(state.currentProfile,state.profilePosts); if (state.activePostId) renderComments(state.activeComments); if (panelVisible("searchPanel")) renderSearchPage();
    } catch (e) { toast(e.message,"error"); }
  }

  function openRepostMenu(kind, id) {
    if (!requireAuth("Connectez-vous pour republier ou citer.")) return;
    const target = kind === "comment" ? findComment(id) : findPost(id);
    if (!target) return toast("Contenu introuvable.","error");
    state.repostTarget = { kind, id:Number(id), item:target };
    const active = Boolean(target.retweetedByMe);
    $("#repostDirectLabel").textContent = active ? "Annuler la republication" : "Republier";
    $("#repostTargetLabel").textContent = kind === "comment" ? "Cette réponse" : "Ce TFI@T";
    $("#repostModal").classList.remove("hidden");
  }

  async function executeRepost() {
    const target=state.repostTarget; if (!target) return;
    try {
      const endpoint = target.kind === "comment" ? `/api/comments/${target.id}/retweet` : `/api/posts/${target.id}/retweet`;
      const data=await api(endpoint,{method:"POST"});
      const retweeted=Boolean(data.retweeted);
      target.item.retweetedByMe=retweeted; target.item.retweetCount=Number(data.count||0);
      $("#repostModal").classList.add("hidden"); state.repostTarget=null;
      toast(retweeted ? "Republication publiée." : "Republication annulée.","success");
      await Promise.all([pollFeed(), state.currentProfile ? pollProfile() : Promise.resolve(), state.activePostId ? pollComments() : Promise.resolve()]);
    } catch(e){ toast(e.message,"error"); }
  }

  function openQuoteComposer() {
    const target=state.repostTarget; if (!target) return;
    state.quoteTarget={...target}; state.repostTarget=null;
    $("#repostModal").classList.add("hidden");
    $("#quoteText").value=""; state.quoteFiles=[]; $("#quoteFiles").value=""; renderFilePreview("quoteFiles");
    const item=target.item;
    const display = target.kind === "comment" ? {type:"comment",comment:item} : {type:"post",post:item};
    $("#quoteTargetPreview").innerHTML=quoteCardMarkup(display);
    $("#quoteModal").classList.remove("hidden"); $("#quoteText").focus();
  }

  async function sendQuote() {
    if (!state.quoteTarget) return;
    const content=$("#quoteText").value.trim(); if (!content) return toast("Ajoutez un message à votre citation.","error");
    const btn=$("#sendQuote"); btn.disabled=true;
    try {
      const sent=[...state.quoteFiles];
      const base=state.quoteTarget.kind === "comment" ? "comments" : "posts";
      await api(`/api/${base}/${state.quoteTarget.id}/quote`,{method:"POST",body:{content,media:mediaForApi(sent)}});
      registerGiphySent(sent); $("#quoteModal").classList.add("hidden"); state.quoteTarget=null; state.quoteFiles=[];
      toast("Citation publiée.","success"); await Promise.all([loadFeed(),loadMe(),state.currentProfile?pollProfile():Promise.resolve()]);
    } catch(e){ toast(e.message,"error"); } finally { btn.disabled=false; }
  }

  function openEditPost(id) {
    const post = findPost(id);
    if (!post || !state.me || Number(post.author.id) !== Number(state.me.id)) return;
    state.editingPostId = Number(id); $("#editPostText").value = post.content || ""; $("#editPostModal").classList.remove("hidden"); $("#editPostText").focus();
  }

  async function savePostEdit() {
    const id = state.editingPostId;
    if (!id) return;
    const button = $("#savePostEdit"); button.disabled = true;
    try {
      const { post } = await api(`/api/posts/${id}`, { method: "PATCH", body: { content: $("#editPostText").value } });
      replacePost(post); $("#editPostModal").classList.add("hidden"); state.editingPostId = null;
      renderFeed(); if (state.currentProfile) renderProfilePage(state.currentProfile, state.profilePosts); if (panelVisible("searchPanel")) renderSearchPage();
      if (state.activePostId === Number(id) && !$("#commentsModal").classList.contains("hidden")) await openComments(id);
      toast(post.edited ? "TFI@T modifié." : "Aucune modification détectée.", "success");
    } catch (e) { toast(e.message, "error"); } finally { button.disabled = false; }
  }

  async function deleteOwnPost(id) {
    const post = findPost(id);
    if (!post || !state.me || Number(post.author.id) !== Number(state.me.id)) return;
    if (!window.confirm("Supprimer définitivement ce TFI@T ? Cette action est irréversible.")) return;
    try {
      await api(`/api/posts/${id}`, { method: "DELETE" }); removePostFromState(id); renderFeed();
      if (state.currentProfile) renderProfilePage(state.currentProfile, state.profilePosts); if (panelVisible("searchPanel")) renderSearchPage();
      if (state.activePostId === Number(id)) $("#commentsModal").classList.add("hidden");
      await loadMe(); toast("TFI@T supprimé.", "success");
    } catch (e) { toast(e.message, "error"); }
  }

  async function openComments(id) {
    state.activePostId = Number(id);
    const cachedPost = findPost(id);
    $("#commentsPost").innerHTML = cachedPost ? postMarkup(cachedPost, { hideActions: true }) : `<div class="loading-small">Chargement du TFI@T d’origine…</div>`;
    $("#commentsList").innerHTML = `<div class="loading">Chargement des réponses…</div>`;
    $("#commentsModal").classList.remove("hidden"); $("#commentComposer").classList.toggle("hidden", !state.me);
    try {
      const data = await api(`/api/posts/${id}/comments`);
      const post = data.post || cachedPost;
      $("#commentsPost").innerHTML = post ? postMarkup(post, { hideActions: true }) : `<div class="loading-small">TFI@T d’origine introuvable.</div>`;
      state.activeComments = data.items || [];
      renderComments(state.activeComments);
    }
    catch (e) {
      $("#commentsPost").innerHTML = `<div class="loading-small">Impossible de charger le TFI@T d’origine.</div>`;
      $("#commentsList").innerHTML = `<div class="loading">${escapeHtml(e.message)}</div>`;
    }
  }

  function replyMarkup(entry, { inThread = false } = {}) {
    const c = entry?.entryType === "reply" ? entry : { ...entry, entryType:"reply", replyId:Number(entry.id), id:`reply-${Number(entry.id)}` };
    const retweet=c.retweetedBy;
    const popular = ""; // v0.4.0.2: les réponses mises en avant restent visuellement naturelles, sans bandeau spécial.
    const parent = !inThread && c.parentPost ? `<div class="reply-parent-card"><div class="reply-parent-label">TFI@T d’origine</div>${quoteCardMarkup({ type:"post", post:c.parentPost })}</div>` : "";
    return `${popular}${retweet ? `<div class="retweet-note reply-retweet-note">${icon("retweet")} <a href="#" data-profile="${escapeHtml(retweet.username)}">${escapeHtml(retweet.displayName || `@${retweet.username}`)}</a> a republié cette réponse</div>` : ""}${parent}
      <article class="post profile-reply ${inThread ? "thread-reply" : ""}" data-reply-id="${c.replyId}">
        ${avatarMarkup(c.author,"post-avatar")}
        <div class="post-main">
          <div class="post-head"><strong><a href="#" data-profile="${escapeHtml(c.author.username)}">${escapeHtml(c.author.displayName)}</a></strong>${verifiedBadge(c.author)}${c.author.isAdmin?`<span class="mini-admin">${icon("shield")}</span>`:""}<span class="handle">@${escapeHtml(c.author.username)}</span>${c.edited ? `<span class="edited-label" title="Modifié le ${escapeHtml(new Date(c.editedAt).toLocaleString("fr-FR"))}">Modifié</span>` : ""}<span class="time">${relativeDate(c.eventAt||c.createdAt)}</span>${c.ownedByMe ? `<div class="post-menu-wrap"><button class="post-menu" data-action="menu" data-id="comment-${c.replyId}" title="Plus">${icon("more")}</button><div class="post-dropdown hidden" data-menu-for="comment-${c.replyId}"><button data-action="comment-edit" data-id="${c.replyId}">${icon("edit")} Modifier</button><button class="danger" data-action="comment-delete" data-id="${c.replyId}">${icon("trash")} Supprimer</button></div></div>` : ""}</div>
          <div class="reply-context">En réponse à <a href="#" data-profile="${escapeHtml(c.replyingTo?.username||"")}">@${escapeHtml(c.replyingTo?.username||"utilisateur")}</a></div>
          <div class="post-content">${linkify(c.content||"")}</div>${mediaMarkup(c.media||[])}
          <div class="post-actions reply-actions">
            <button class="action-button reply-action" data-action="reply-comment" data-kind="comment" data-id="${c.replyId}" title="Répondre">${icon("reply")}</button>
            <button class="action-button retweet-action ${c.retweetedByMe?"retweeted":""}" data-action="repost-menu" data-kind="comment" data-id="${c.replyId}" title="Republier ou citer">${icon("retweet")}<span>${formatMetric(c.retweetCount)}</span></button>
            <button class="action-button like-action ${c.likedByMe?"liked":""}" data-action="comment-like" data-kind="comment" data-id="${c.replyId}" title="J'aime">${icon("heart",c.likedByMe)}<span>${formatMetric(c.likeCount)}</span></button>
            <button class="action-button share-action" data-action="comment-share" data-kind="comment" data-id="${c.replyId}" title="Partager">${icon("share")}</button>
          </div>
          ${!inThread ? `<button class="conversation-link" data-open-conversation="${c.parentPostId}">Voir la conversation</button>` : ""}
        </div>
      </article>`;
  }

  function renderComments(items) {
    const list=$("#commentsList"); state.activeComments=items||[];
    list.innerHTML=state.activeComments.length ? state.activeComments.map(c=>replyMarkup(c,{inThread:true})).join("") : `<div class="loading-small">Aucune réponse pour l'instant.</div>`;
    list.dataset.pollSignature=signature(state.activeComments);
  }

  function openEditComment(id) {
    const comment = findComment(id);
    if (!comment || !comment.ownedByMe) return;
    state.editingCommentId = Number(id);
    $("#editCommentText").value = comment.content || "";
    $("#editCommentModal").classList.remove("hidden");
    setTimeout(() => $("#editCommentText")?.focus(), 0);
  }

  async function saveCommentEdit() {
    if (!state.editingCommentId) return;
    const content = $("#editCommentText").value.trim();
    try {
      await api(`/api/comments/${state.editingCommentId}`, { method: "PATCH", body: { content } });
      $("#editCommentModal").classList.add("hidden");
      state.editingCommentId = null;
      if (state.activePostId) await openComments(state.activePostId);
      await loadFeed();
      if (state.currentProfile) await loadProfileActivity(state.currentProfile.username, state.profileTab, { silent: true });
      if (panelVisible("searchPanel") && state.search.query) await pollSearch();
      toast("Réponse modifiée.", "success");
    } catch (e) { toast(e.message, "error"); }
  }

  async function deleteOwnComment(id) {
    const comment = findComment(id);
    if (!comment || !comment.ownedByMe) return;
    if (!window.confirm("Supprimer définitivement cette réponse ? Cette action est irréversible.")) return;
    try {
      const result = await api(`/api/comments/${id}`, { method: "DELETE" });
      state.activeComments = state.activeComments.filter(c => Number(c.replyId || c.id) !== Number(id));
      renderComments(state.activeComments);
      await loadFeed();
      if (state.currentProfile) await loadProfileActivity(state.currentProfile.username, state.profileTab, { silent: true });
      if (panelVisible("searchPanel") && state.search.query) await pollSearch();
      if (state.activePostId && Number(result.postId || state.activePostId) === Number(state.activePostId)) {
        const data = await api(`/api/posts/${state.activePostId}/comments`);
        if (data.post) $("#commentsPost").innerHTML = postMarkup(data.post, { hideActions: true });
        state.activeComments = data.items || [];
        renderComments(state.activeComments);
      }
      toast("Réponse supprimée.", "success");
    } catch (e) { toast(e.message, "error"); }
  }

  async function sendComment() {
    if (!requireAuth()) return;
    const content = $("#commentText").value.trim();
    if (!content && !state.commentFiles.length) return toast("Votre réponse est vide.", "error");
    try {
      const sentMedia = [...state.commentFiles];
      await api(`/api/posts/${state.activePostId}/comments`, { method: "POST", body: { content, media: mediaForApi(sentMedia) } });
      registerGiphySent(sentMedia);
      $("#commentText").value = ""; state.commentFiles = []; $("#commentFiles").value = ""; renderFilePreview("commentFiles");
      [...state.feed, ...state.profilePosts].filter(p => p?.entryType !== "reply" && Number(p.id) === state.activePostId).forEach(p => p.commentCount += 1);
      await openComments(state.activePostId); renderFeed(); if (state.currentProfile) renderProfilePage(state.currentProfile, state.profilePosts);
    } catch (e) { toast(e.message, "error"); }
  }

  const PROFILE_TABS = {
    tweets: "TFI@Ts",
    replies: "Réponses",
    media: "Médias",
    likes: "J'aime"
  };

  function profileEntryMarkup(entry) {
    return entry?.entryType === "reply" ? replyMarkup(entry) : postMarkup(entry);
  }

  function profileEmptyMarkup(tab) {
    const messages = {
      tweets: ["Pas encore de TFI@T", "Les publications et retweets de ce compte apparaîtront ici."],
      replies: ["Aucune réponse", "Les réponses envoyées à d’autres TFI@Ts apparaîtront ici."],
      media: ["Aucun média", "Les TFI@Ts et réponses contenant des images, vidéos ou documents apparaîtront ici."],
      likes: ["Aucun J’aime", "Les TFI@Ts aimés par ce compte apparaîtront ici."]
    };
    const [title, copy] = messages[tab] || messages.tweets;
    return `<div class="empty-state"><h3>${title}</h3><p>${copy}</p></div>`;
  }

  async function loadProfileActivity(username, tab = state.profileTab || "tweets") {
    const data = await api(`/api/profile/${encodeURIComponent(username)}/posts?tab=${encodeURIComponent(tab)}`);
    state.profileTab = data.tab || tab;
    state.profilePosts = data.items || [];
    return state.profilePosts;
  }

  async function openProfile(username, scroll = true, requestedTab = null) {
    if (!requireAuth("Connectez-vous pour consulter les profils.")) return;
    username = String(username || "").replace(/^@/, ""); if (!username) return;
    const switchingProfile = !state.currentProfile || state.currentProfile.username.toLowerCase() !== username.toLowerCase();
    if (requestedTab) state.profileTab = requestedTab;
    else if (switchingProfile) state.profileTab = "tweets";
    showCenter("profilePanel"); setNavActive(""); $("#profilePanel").innerHTML = `<div class="loading">Chargement du profil…</div>`;
    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const [profileData, postsData] = await Promise.all([
        api(`/api/profile/${encodeURIComponent(username)}`),
        api(`/api/profile/${encodeURIComponent(username)}/posts?tab=${encodeURIComponent(state.profileTab)}`)
      ]);
      state.currentProfile = profileData.user; state.profileTab = postsData.tab || state.profileTab; state.profilePosts = postsData.items || [];
      renderProfilePage(profileData.user, state.profilePosts);
    } catch (e) { $("#profilePanel").innerHTML = `<div class="empty-state"><h3>Profil indisponible</h3><p>${escapeHtml(e.message)}</p></div>`; }
  }

  async function switchProfileTab(tab) {
    if (!state.currentProfile || !PROFILE_TABS[tab] || state.profileTab === tab) return;
    state.profileTab = tab;
    const list = $("#profileActivity");
    if (list) list.innerHTML = `<div class="loading">Chargement…</div>`;
    $$("[data-profile-tab]").forEach(b => b.classList.toggle("active", b.dataset.profileTab === tab));
    try {
      await loadProfileActivity(state.currentProfile.username, tab);
      renderProfilePage(state.currentProfile, state.profilePosts);
    } catch (e) {
      if (list) list.innerHTML = `<div class="empty-state"><h3>Impossible de charger cet onglet</h3><p>${escapeHtml(e.message)}</p></div>`;
    }
  }

  function renderProfilePage(u, posts) {
    const mine = state.me && state.me.username === u.username, banner = safeUrl(u.bannerUrl), website = safeUrl(u.website);
    $("#profilePanel").innerHTML = `<div class="back-row"><button id="backHome">←</button><strong>${escapeHtml(u.displayName)}</strong></div>
      <section class="profile-page">
        <div class="profile-page-banner" ${banner ? `style="background-image:url('${escapeHtml(banner)}')"` : ""}></div>
        <div class="profile-page-info">
          ${avatarMarkup(u, "profile-page-avatar")}
          <div class="profile-page-actions">${mine ? `<button class="outline-button" id="editProfileButton">Modifier le profil</button>${state.me?.isTrainer ? `<button class="animation-button" data-open-animation>${icon("chart")} Animation</button>` : ""}${state.me?.isAdmin ? `<button class="admin-button" data-open-admin>${icon("shield")} Administration</button>` : ""}` : `${state.me ? `<button class="outline-button message-profile-button" data-message-profile="${escapeHtml(u.username)}">${icon("message")}</button>` : ""}<button class="${u.isFollowing ? "tweet-button" : "outline-button"}" id="profileFollowButton">${u.isFollowing ? "Abonné" : "Suivre"}</button>`}</div>
          <div class="profile-page-name"><h1>${escapeHtml(u.displayName)} ${verifiedBadge(u)} ${adminBadge(u)}</h1><div class="handle">@${escapeHtml(u.username)}</div></div>
          ${u.bio ? `<div class="profile-page-bio">${linkify(u.bio)}</div>` : ""}
          <div class="profile-meta">${u.location ? `<span>${icon("location")} ${escapeHtml(u.location)}</span>` : ""}${website ? `<a href="${escapeHtml(website)}" target="_blank" rel="noopener">🔗 ${escapeHtml(u.website)}</a>` : ""}<span>◷ Inscrit en ${longDate(u.createdAt)}</span></div>
          <div class="profile-numbers"><button data-connections="following" data-connections-user="${escapeHtml(u.username)}"><b>${u.followingCount}</b> abonnements</button><button data-connections="followers" data-connections-user="${escapeHtml(u.username)}"><b>${formatMetric(u.followersCount, false)}</b> abonnés</button></div>
        </div>
        <div class="profile-tabs">${Object.entries(PROFILE_TABS).map(([key,label]) => `<button data-profile-tab="${key}" class="${state.profileTab === key ? "active" : ""}">${label}</button>`).join("")}</div>
        <div id="profileActivity">${posts.length ? posts.map(profileEntryMarkup).join("") : profileEmptyMarkup(state.profileTab)}</div>
      </section>`;
  }

  async function openConnections(username, kind) {
    username = String(username || "").trim().replace(/^@/, "");
    if (!username || !["followers", "following"].includes(kind)) return;
    const modal = $("#connectionsModal"), title = $("#connectionsTitle"), list = $("#connectionsList");
    modal.dataset.connectionsUser = username; modal.dataset.connectionsKind = kind;
    title.textContent = kind === "followers" ? "Abonnés" : "Abonnements";
    list.innerHTML = `<div class="loading">Chargement…</div>`;
    modal.classList.remove("hidden");
    try {
      const data = await api(`/api/profile/${encodeURIComponent(username)}/${kind}`);
      const items = data.items || [];
      title.textContent = `${kind === "followers" ? "Abonnés" : "Abonnements"} de @${data.profile?.username || username}`;
      list.innerHTML = items.length ? items.map(u => `<article class="connection-row">
        ${avatarMarkup(u, "connection-avatar")}
        <div class="connection-main"><strong><a href="#" data-profile="${escapeHtml(u.username)}">${escapeHtml(u.displayName)}</a> ${verifiedBadge(u)}</strong><span>@${escapeHtml(u.username)}</span>${u.bio ? `<p>${linkify(u.bio)}</p>` : ""}</div>
        ${state.me && state.me.username !== u.username ? `<button class="${u.isFollowing ? "tweet-button" : "outline-button"} small" data-follow-suggestion="${escapeHtml(u.username)}">${u.isFollowing ? "Abonné" : "Suivre"}</button>` : ""}
      </article>`).join("") : `<div class="empty-state compact-empty"><h3>${kind === "followers" ? "Aucun abonné" : "Aucun abonnement"}</h3><p>Cette liste est vide pour le moment.</p></div>`;
    } catch (e) {
      list.innerHTML = `<div class="empty-state compact-empty"><h3>Liste indisponible</h3><p>${escapeHtml(e.message)}</p></div>`;
    }
  }

  function home() {
    state.currentProfile = null; state.profileTab = "tweets"; state.profilePosts = [];
    state.search.query = ""; state.search.peopleResults = []; state.search.items = [];
    if ($("#searchInput")) $("#searchInput").value = ""; updateSearchClear(); closeSearchSuggestions();
    showCenter("homePanel"); setNavActive("home");
    pollFeed();
  }

  async function followUsername(username) {
    if (!requireAuth("Connectez-vous pour suivre ce profil.")) return;
    try {
      const data = await api(`/api/profile/${encodeURIComponent(username)}/follow`, { method: "POST" });
      toast(data.following ? `Vous suivez maintenant @${username}.` : `Vous ne suivez plus @${username}.`, "success");
      await Promise.all([loadMe(), loadSuggestions(), loadFeed()]); if (state.currentProfile?.username === username) await openProfile(username, false);
      const connectionModal = $("#connectionsModal");
      if (connectionModal && !connectionModal.classList.contains("hidden") && connectionModal.dataset.connectionsUser) await openConnections(connectionModal.dataset.connectionsUser, connectionModal.dataset.connectionsKind);
      if (panelVisible("searchPanel") && state.search.query) await loadSearchResults({ silent: true });
    } catch (e) { toast(e.message, "error"); }
  }

  function openEditProfile() {
    if (!state.me) return;
    $("#editDisplayName").value = state.me.displayName || ""; $("#editBio").value = state.me.bio || ""; $("#editLocation").value = state.me.location || ""; $("#editWebsite").value = state.me.website || "";
    state.editAvatar = null; state.editBanner = null; setEditableAvatar(state.me);
    const banner = safeUrl(state.me.bannerUrl); $("#editBannerPreview").style.backgroundImage = banner ? `url("${banner}")` : ""; $("#editProfileModal").classList.remove("hidden");
  }

  async function saveProfile() {
    const body = { displayName: $("#editDisplayName").value, bio: $("#editBio").value, location: $("#editLocation").value, website: $("#editWebsite").value, avatar: state.editAvatar, banner: state.editBanner };
    try { await api("/api/me", { method: "PATCH", body }); $("#editProfileModal").classList.add("hidden"); await loadMe(); await openProfile(state.me.username, false); toast("Profil mis à jour.", "success"); }
    catch (e) { toast(e.message, "error"); }
  }

  function closeSearchSuggestions() {
    $("#searchSuggestions")?.classList.add("hidden");
  }

  function updateSearchClear() {
    $("#searchClear")?.classList.toggle("hidden", !$("#searchInput")?.value.trim());
  }

  function searchPersonMarkup(u, compact = false) {
    return `<article class="search-person ${compact ? "compact" : ""}">
      ${avatarMarkup(u, "search-person-avatar")}
      <div class="search-person-main">
        <div class="search-person-head"><div><strong><a href="#" data-profile="${escapeHtml(u.username)}">${escapeHtml(u.displayName)}</a></strong> ${verifiedBadge(u)}<span>@${escapeHtml(u.username)}</span></div>
        ${state.me && state.me.username !== u.username && !compact ? `<button class="${u.isFollowing ? "tweet-button" : "outline-button"} small" data-follow-suggestion="${escapeHtml(u.username)}">${u.isFollowing ? "Abonné" : "Suivre"}</button>` : ""}</div>
        ${!compact && u.bio ? `<p>${linkify(u.bio)}</p>` : ""}
      </div>
    </article>`;
  }

  function renderSearchSuggestions(items, query) {
    const box = $("#searchSuggestions");
    if (!box) return;
    if (!query.trim()) { box.innerHTML = ""; box.classList.add("hidden"); return; }
    const rows = (items || []).map(u => `<div class="search-suggestion-row" data-profile="${escapeHtml(u.username)}" role="option" tabindex="0">
      ${avatarMarkup(u, "search-suggestion-avatar")}
      <span><strong>${escapeHtml(u.displayName)} ${verifiedBadge(u)}</strong><small>@${escapeHtml(u.username)}</small></span>
    </div>`).join("");
    box.innerHTML = `${rows || `<div class="search-suggestion-empty">Aucun profil correspondant.</div>`}<button class="search-all-results" type="button" data-search-submit="${escapeHtml(query)}">Rechercher « ${escapeHtml(query)} »</button>`;
    box.classList.remove("hidden");
  }

  function scheduleSearchSuggestions(query) {
    clearTimeout(state.search.suggestionTimer);
    const q = String(query || "").trim();
    updateSearchClear();
    if (!q) { closeSearchSuggestions(); return; }
    state.search.suggestionTimer = setTimeout(async () => {
      const requestId = ++state.search.suggestionRequest;
      try {
        const data = await api(`/api/search/suggestions?q=${encodeURIComponent(q)}`);
        if (requestId !== state.search.suggestionRequest || $("#searchInput")?.value.trim() !== q) return;
        renderSearchSuggestions(data.items || [], q);
      } catch { if (requestId === state.search.suggestionRequest) closeSearchSuggestions(); }
    }, 160);
  }

  function renderSearchFilters() {
    const filters = state.search.filters || {};
    $$('input[name="searchPeople"]').forEach(el => { el.checked = el.value === state.search.people; });
    $$('input[name="searchLocation"]').forEach(el => { el.checked = el.value === state.search.location; });
    const nearby = $('input[name="searchLocation"][value="nearby"]');
    const label = $("#nearbySearchLabel"), hint = $("#nearbySearchHint");
    const available = filters.nearbyAvailable !== false && Boolean(filters.viewerLocation || state.me?.location);
    if (nearby) nearby.disabled = !available;
    label?.classList.toggle("disabled", !available);
    if (hint) {
      hint.classList.toggle("hidden", available);
      hint.textContent = available ? "" : "Ajoutez une localisation à votre profil pour utiliser ce filtre.";
    }
  }

  function searchEmptyMarkup(tab) {
    const copy = tab === "people" ? "Aucun profil ne correspond à cette recherche." : tab === "media" ? "Aucune photo ou vidéo ne correspond à cette recherche." : "Aucun contenu ne correspond à cette recherche.";
    return `<div class="empty-state search-empty"><h3>Aucun résultat</h3><p>${copy}</p></div>`;
  }

  function renderSearchPage() {
    const panel = $("#searchPanel");
    if (!panel) return;
    const q = state.search.query;
    const tabs = [["top","Top"],["latest","Latest"],["people","People"],["media","Media"]];
    const peopleSection = state.search.tab === "top" && state.search.peopleResults.length ? `<section class="search-people-section"><div class="search-section-title"><strong>Personnes</strong><button data-search-tab="people">Voir tout</button></div>${state.search.peopleResults.map(u => searchPersonMarkup(u)).join("")}</section>` : "";
    let body = "";
    if (state.search.tab === "people") {
      body = state.search.peopleResults.length ? `<div class="search-people-page">${state.search.peopleResults.map(u => searchPersonMarkup(u)).join("")}</div>` : searchEmptyMarkup("people");
    } else {
      body = `${peopleSection}<div class="search-content-results">${state.search.items.length ? state.search.items.map(profileEntryMarkup).join("") : searchEmptyMarkup(state.search.tab)}</div>`;
    }
    panel.innerHTML = `<div class="search-page-header"><button class="search-back" data-search-back aria-label="Retour">←</button><div><strong>Résultats de recherche</strong><span>« ${escapeHtml(q)} »</span></div></div>
      <div class="search-tabs">${tabs.map(([key,label]) => `<button class="${state.search.tab === key ? "active" : ""}" data-search-tab="${key}">${label}</button>`).join("")}</div>
      ${body}`;
    renderSearchFilters();
  }

  async function loadSearchResults({ silent = false } = {}) {
    const q = state.search.query.trim();
    if (!q) return;
    if (!silent) $("#searchPanel").innerHTML = `<div class="loading">Recherche en cours…</div>`;
    try {
      const params = new URLSearchParams({ q, tab: state.search.tab, people: state.search.people, location: state.search.location, limit: "50" });
      const data = await api(`/api/search?${params.toString()}`);
      state.search.peopleResults = data.people || [];
      state.search.items = data.items || [];
      state.search.filters = data.filters || {};
      state.search.tab = data.tab || state.search.tab;
      if (state.search.location === "nearby" && data.filters?.nearbyAvailable === false) {
        state.search.location = "anywhere";
        return loadSearchResults({ silent: true });
      }
      renderSearchPage();
    } catch (e) {
      $("#searchPanel").innerHTML = `<div class="empty-state"><h3>Recherche indisponible</h3><p>${escapeHtml(e.message)}</p></div>`;
    }
  }

  async function openSearchResults(query, tab = "top", scroll = true) {
    if (!requireAuth("Connectez-vous pour effectuer une recherche.")) return;
    const q = String(query || "").trim();
    if (!q) return;
    state.search.query = q;
    state.search.tab = ["top","latest","people","media"].includes(tab) ? tab : "top";
    $("#searchInput").value = q; updateSearchClear(); closeSearchSuggestions();
    state.currentProfile = null; showCenter("searchPanel"); setNavActive("");
    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
    await loadSearchResults();
  }

  async function switchSearchTab(tab) {
    if (!["top","latest","people","media"].includes(tab) || state.search.tab === tab) return;
    state.search.tab = tab;
    await loadSearchResults();
  }

  function animationRangeText(r) {
    return `${Number(r.likesMin).toLocaleString("fr-FR")}–${Number(r.likesMax).toLocaleString("fr-FR")} J’aime · ${Number(r.retweetsMin).toLocaleString("fr-FR")}–${Number(r.retweetsMax).toLocaleString("fr-FR")} ReTFI@Ts`;
  }

  function animationTargetMarkup(target) {
    const item = target.item || {}, a = item.author || {};
    const isReply = target.targetType === "comment";
    const rating = target.rating;
    const parent = isReply ? item.parentPost : null;
    return `<article class="animation-target ${rating ? "rated" : ""}">
      <div class="animation-target-head">
        ${avatarMarkup(a, "animation-avatar")}
        <div class="animation-target-meta"><strong>${escapeHtml(a.displayName || "Compte")}</strong>${verifiedBadge(a)}<span>@${escapeHtml(a.username || "")} · ${relativeDate(item.createdAt)}</span><small>${isReply ? "Réponse informationnelle" : "TFI@T"}</small></div>
        ${rating ? `<div class="animation-score-pill">${rating.score}/10</div>` : ""}
      </div>
      ${isReply && parent ? `<div class="animation-parent"><b>TFI@T d’origine</b><span>@${escapeHtml(parent.author?.username || "")} · ${escapeHtml((parent.content || "").slice(0,180))}${(parent.content || "").length>180?"…":""}</span></div>` : ""}
      <div class="animation-target-content">${linkify(item.content || "")}</div>
      <div class="animation-target-stats"><span>${icon("heart", Number(item.likeCount||0)>0)} ${Number(item.likeCount||0).toLocaleString("fr-FR")}</span><span>${icon("retweet")} ${Number(item.retweetCount||0).toLocaleString("fr-FR")}</span><button type="button" data-open-conversation="${isReply ? item.parentPostId : item.id}">Voir</button></div>
      ${rating ? `<div class="animation-result"><strong>Noté ${rating.score}/10</strong><span>${Number(rating.likesAdded||0).toLocaleString("fr-FR")} / ${Number(rating.likesTarget||0).toLocaleString("fr-FR")} likes · ${Number(rating.retweetsAdded||0).toLocaleString("fr-FR")} / ${Number(rating.retweetsTarget||0).toLocaleString("fr-FR")} ReTFI@Ts${rating.trainer ? ` par @${escapeHtml(rating.trainer.username)}` : ""}.</span></div>` : `<div class="animation-note-buttons" aria-label="Attribuer une note">${Array.from({length:10},(_,i)=>i+1).map(n=>`<button type="button" data-animation-score="${n}" data-animation-kind="${target.targetType}" data-animation-id="${target.targetId}" title="Noter ${n}/10">${n}</button>`).join("")}</div>`}
    </article>`;
  }

  function renderAnimationPanel() {
    const content = $("#animationContent"); if (!content) return;
    const o = state.animation.overview || {}, rubric = state.animation.rubric || [], targets = state.animation.targets || [];
    content.innerHTML = `
      <div class="animation-hero"><div>${icon("chart")}<div><h2>Animation TFI@TTER</h2><p>Notation des attaques et réponses informationnelles et simulation de leur réception.</p></div></div><span class="version-pill animation-version">v0.5.0</span></div>
      <div class="animation-stats"><div><b>${Number(o.reaction_pool||0).toLocaleString("fr-FR")}</b><span>Comptes de réaction</span></div><div><b>${Number(o.scored_total||0).toLocaleString("fr-FR")}</b><span>Contenus notés</span></div><div><b>${Number(o.scored_by_me||0).toLocaleString("fr-FR")}</b><span>Notés par moi</span></div><div><b>${Number(o.scored_today||0).toLocaleString("fr-FR")}</b><span>Aujourd’hui</span></div></div>
      <details class="animation-rubric"><summary>Barème de notation 1 à 10</summary><div class="animation-rubric-grid">${rubric.map(r=>`<div class="rubric-row"><b>${r.score}/10</b><div><strong>${escapeHtml(r.label)}</strong><p>${escapeHtml(r.description)}</p><small>${animationRangeText(r)}</small></div></div>`).join("")}</div></details>
      <form id="animationSearchForm" class="animation-search"><input name="q" value="${escapeHtml(state.animation.q)}" placeholder="Rechercher un auteur ou un contenu…"><select name="kind"><option value="all" ${state.animation.kind==="all"?"selected":""}>TFI@Ts + réponses</option><option value="post" ${state.animation.kind==="post"?"selected":""}>TFI@Ts uniquement</option><option value="comment" ${state.animation.kind==="comment"?"selected":""}>Réponses uniquement</option></select><button class="outline-button" type="submit">Filtrer</button></form>
      <div class="animation-help">Clique sur une note pour appliquer le barème. Un contenu ne peut être noté qu’une seule fois : TFI@TTER choisit une cible aléatoire puis fait arriver progressivement les likes et ReTFI@Ts pendant 60 secondes.</div>
      <div class="animation-targets">${targets.length ? targets.map(animationTargetMarkup).join("") : `<div class="empty-state compact-empty"><h3>Aucun contenu</h3><p>Aucun TFI@T ou réponse ne correspond à ce filtre.</p></div>`}</div>`;
  }

  async function loadAnimationTargets({silent=false}={}) {
    if (!state.me?.isTrainer) return;
    if (!silent) $("#animationContent").innerHTML = `<div class="loading">Chargement des contenus…</div>`;
    const params = new URLSearchParams({q:state.animation.q||"",kind:state.animation.kind||"all",limit:"100"});
    const [overview,targets] = await Promise.all([api("/api/trainer/overview"),api(`/api/trainer/targets?${params.toString()}`)]);
    state.animation.overview = overview.stats || {}; state.animation.rubric = overview.rubric || []; state.animation.targets = targets.items || [];
    renderAnimationPanel();
  }

  async function openAnimationPanel() {
    if (!state.me?.isTrainer) return toast("Accès réservé aux membres ayant le rôle Entraîneur.","error");
    $("#animationModal").classList.remove("hidden");
    $("#animationContent").innerHTML = `<div class="loading">Chargement du panneau Animation…</div>`;
    try { await loadAnimationTargets({silent:true}); }
    catch(e) { $("#animationContent").innerHTML = `<div class="empty-state"><h3>Animation indisponible</h3><p>${escapeHtml(e.message)}</p></div>`; }
  }

  async function rateAnimationTarget(kind,id,score) {
    const rubric = (state.animation.rubric||[]).find(r=>Number(r.score)===Number(score));
    const detail = rubric ? `\n${rubric.label}\n${animationRangeText(rubric)}` : "";
    if (!window.confirm(`Attribuer la note ${score}/10 à ce contenu ?${detail}\n\nCette action programmera les réactions sur 60 secondes et ne pourra pas être rejouée sur ce contenu.`)) return;
    try {
      const result = await api("/api/trainer/rate",{method:"POST",body:{targetType:kind,targetId:Number(id),score:Number(score)}});
      toast(`${score}/10 — cible ${Number(result.likes?.target||0).toLocaleString("fr-FR")} likes / ${Number(result.retweets?.target||0).toLocaleString("fr-FR")} ReTFI@Ts, arrivée progressive sur 60 s.`,"success");
      await Promise.all([loadAnimationTargets({silent:true}),pollFeed()]);
      if (state.currentProfile) await pollProfile();
    } catch(e) { toast(e.message,"error"); }
  }

  async function openAdminPanel() {
    if (!state.me?.isAdmin) return toast("Accès administrateur requis.", "error");
    $("#adminModal").classList.remove("hidden"); $("#adminContent").innerHTML = `<div class="loading">Chargement de l'administration…</div>`;
    try {
      const [overview, users, posts] = await Promise.all([api("/api/admin/overview"), api("/api/admin/users"), api("/api/admin/posts?limit=60")]);
      state.admin = { overview: overview.stats, users: users.items || [], posts: posts.items || [], viewerId: users.viewerId }; renderAdminPanel();
    } catch (e) { $("#adminContent").innerHTML = `<div class="empty-state"><h3>Administration indisponible</h3><p>${escapeHtml(e.message)}</p></div>`; }
  }

  function renderAdminPanel(filter = "") {
    const s = state.admin.overview || {}, meId = Number(state.admin.viewerId || state.me?.id), q = filter.trim().toLowerCase();
    const users = state.admin.users.filter(u => !q || [u.username,u.displayName,u.email].join(" ").toLowerCase().includes(q));
    $("#adminContent").innerHTML = `
      <div class="admin-hero"><div>${icon("shield")}<div><h2>Administration TFI@TTER</h2><p>Création de comptes, certification, rôles et modération.</p></div></div><span class="version-pill">v0.5.0</span></div>
      <div class="admin-stats">
        <div><b>${s.users ?? 0}</b><span>Membres</span></div><div><b>${s.active_users ?? 0}</b><span>Actifs</span></div><div><b>${s.admins ?? 0}</b><span>Administrateurs</span></div><div><b>${s.trainers ?? 0}</b><span>Entraîneurs</span></div><div><b>${s.verified ?? 0}</b><span>Certifiés</span></div><div><b>${s.posts ?? 0}</b><span>TFI@Ts</span></div><div><b>${s.comments ?? 0}</b><span>Réponses</span></div><div><b>${s.likes ?? 0}</b><span>Likes</span></div>
      </div>
      <section class="admin-section admin-create-section">
        <div class="admin-section-title"><div>${icon("users")}<h3>Créer un compte</h3></div></div>
        <form id="adminCreateUserForm" class="admin-create-form">
          <label>Nom affiché<input name="displayName" maxlength="50" required placeholder="Institution ou membre"></label>
          <label>@identifiant<input name="username" minlength="3" maxlength="20" pattern="[a-zA-Z0-9_]+" required placeholder="identifiant"></label>
          <label>E-mail<input name="email" type="email" required placeholder="compte@exemple.fr"></label>
          <label>Mot de passe initial<input name="password" type="password" minlength="8" required autocomplete="new-password"></label>
          <label>Nombre d’abonnés<input name="followersCount" type="number" min="0" max="100000000" step="1" value="0" inputmode="numeric"><small>0 à 100 000 000 abonnés. Jusqu’à 60 000 sont matérialisés ; le surplus est simulé.</small></label>
          <label class="admin-avatar-field">Photo de profil<input name="avatar" type="file" accept="image/*"></label>
          <label class="admin-check"><input name="isVerified" type="checkbox"> Compte officiel certifié</label>
          <label class="admin-check"><input name="isTrainer" type="checkbox"> Entraîneur</label>
          <label class="admin-check"><input name="isAdmin" type="checkbox"> Administrateur</label>
          <button class="tweet-button" type="submit">Créer le compte</button>
        </form>
      </section>
      <section class="admin-section">
        <div class="admin-section-title"><div>${icon("users")}<h3>Membres</h3></div><input id="adminUserSearch" value="${escapeHtml(filter)}" placeholder="Rechercher un membre…"></div>
        <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Membre</th><th>Statut</th><th>TFI@Ts</th><th>Abonnés</th><th>Actions</th></tr></thead><tbody>
          ${users.map(u => `<tr class="${u.isActive ? "" : "disabled-user"}"><td><strong>${escapeHtml(u.displayName)}</strong><span>@${escapeHtml(u.username)}</span><small>${escapeHtml(u.email)}</small></td><td><span class="role-badge ${u.isAdmin ? "admin" : ""}">${u.isAdmin ? "Administrateur" : "Membre"}</span>${u.isTrainer ? `<span class="trainer-status">Entraîneur</span>` : ""}${u.isVerified ? `<span class="verified-status">${verifiedBadge(u)} Certifié</span>` : ""}${u.isActive ? "" : `<span class="status-badge">Désactivé</span>`}</td><td>${u.postsCount}</td><td>${formatMetric(u.followersCount, false)}</td><td><div class="admin-actions">
            <button class="outline-button small" data-admin-verified="${u.id}" data-next-verified="${!u.isVerified}">${u.isVerified ? "Retirer certification" : "Certifier"}</button>
            <button class="outline-button small trainer-outline" data-admin-trainer="${u.id}" data-next-trainer="${!u.isTrainer}">${u.isTrainer ? "Retirer entraîneur" : "Nommer entraîneur"}</button>
            <button class="outline-button small" data-admin-role="${u.id}" data-next-admin="${!u.isAdmin}" ${Number(u.id)===meId ? "disabled" : ""}>${u.isAdmin ? "Rétrograder" : "Nommer admin"}</button>
            <button class="outline-button small ${u.isActive ? "danger-outline" : ""}" data-admin-active="${u.id}" data-next-active="${!u.isActive}" ${Number(u.id)===meId || (u.isAdmin && u.isActive) ? "disabled" : ""}>${u.isActive ? "Désactiver" : "Réactiver"}</button>
          </div></td></tr>`).join("") || `<tr><td colspan="5">Aucun membre trouvé.</td></tr>`}
        </tbody></table></div>
      </section>
      <section class="admin-section">
        <div class="admin-section-title"><div>${icon("chart")}<h3>Modération — derniers TFI@Ts</h3></div></div>
        <div class="moderation-list">${state.admin.posts.map(p => `<div class="moderation-post"><div><strong>${escapeHtml(p.author.displayName)}</strong> <span>@${escapeHtml(p.author.username)}</span>${p.edited ? `<em>Modifié</em>` : ""}<p>${escapeHtml((p.content || "").slice(0, 420))}${(p.content || "").length > 420 ? "…" : ""}</p></div><button class="moderation-delete" data-admin-delete-post="${p.id}" title="Supprimer ce TFI@T">${icon("trash")} Supprimer</button></div>`).join("") || `<div class="loading-small">Aucune publication.</div>`}</div>
      </section>`;
  }

  async function adminCreateUser(form) {
    const fd = new FormData(form);
    const avatarFile = fd.get("avatar");
    let avatar = null;
    if (avatarFile && avatarFile.size) avatar = await readFile(avatarFile);
    const body = {
      displayName: fd.get("displayName"), username: fd.get("username"), email: fd.get("email"), password: fd.get("password"), followersCount: Number(fd.get("followersCount") || 0),
      isVerified: fd.get("isVerified") === "on", isTrainer: fd.get("isTrainer") === "on", isAdmin: fd.get("isAdmin") === "on", avatar
    };
    try {
      await api("/api/admin/users", { method: "POST", body });
      form.reset();
      await openAdminPanel();
      toast("Compte créé par l'administration.", "success");
    } catch (e) { toast(e.message, "error"); }
  }

  async function adminUpdateUser(id, patch) {
    try {
      await api(`/api/admin/users/${id}`, { method: "PATCH", body: patch });
      await Promise.all([loadMe(), openAdminPanel()]); toast("Droits du membre mis à jour.", "success");
    } catch (e) { toast(e.message, "error"); }
  }

  async function adminDeletePost(id) {
    if (!window.confirm("Supprimer ce TFI@T au titre de la modération ?")) return;
    try {
      await api(`/api/admin/posts/${id}`, { method: "DELETE" }); removePostFromState(id); state.admin.posts = state.admin.posts.filter(p => Number(p.id) !== Number(id));
      if (state.admin.overview) state.admin.overview.posts = Math.max(0, Number(state.admin.overview.posts || 1) - 1);
      renderAdminPanel($("#adminUserSearch")?.value || ""); renderFeed(); if (state.currentProfile) renderProfilePage(state.currentProfile, state.profilePosts); await loadMe(); toast("TFI@T supprimé par la modération.", "success");
    } catch (e) { toast(e.message, "error"); }
  }

  function closePostMenus(exceptId = null) {
    $$(".post-dropdown").forEach(m => m.classList.toggle("hidden", String(m.dataset.menuFor) !== String(exceptId)));
  }

  function bindEvents() {
    document.addEventListener("click", async e => {
      const mediaOpen = e.target.closest("[data-media-open]"); if (mediaOpen) { e.preventDefault(); e.stopPropagation(); return openMediaModal(mediaOpen); }
      const auth = e.target.closest("[data-open-auth]"); if (auth) return openAuth(auth.dataset.openAuth);
      if (e.target.closest("[data-close-modal]")) return closeAuth();
      const tab = e.target.closest("[data-auth-tab]"); if (tab) return switchAuthTab(tab.dataset.authTab);
      const searchSubmit = e.target.closest("[data-search-submit]"); if (searchSubmit) { e.preventDefault(); return openSearchResults(searchSubmit.dataset.searchSubmit || $("#searchInput").value, "top"); }
      const searchTab = e.target.closest("[data-search-tab]"); if (searchTab) { e.preventDefault(); return switchSearchTab(searchTab.dataset.searchTab); }
      const searchBack = e.target.closest("[data-search-back]"); if (searchBack) { e.preventDefault(); return home(); }
      if (!e.target.closest("#searchWrap")) closeSearchSuggestions();
      const profile = e.target.closest("[data-profile]"); if (profile) { e.preventDefault(); closeSearchSuggestions(); const u = profile.dataset.profile; if (u) { $("#connectionsModal")?.classList.add("hidden"); openProfile(u); } return; }
      const connections = e.target.closest("[data-connections]"); if (connections) { e.preventDefault(); e.stopPropagation(); return openConnections(connections.dataset.connectionsUser, connections.dataset.connections); }
      const openAnimation = e.target.closest("[data-open-animation]"); if (openAnimation) return openAnimationPanel();
      const openAdmin = e.target.closest("[data-open-admin]"); if (openAdmin) return openAdminPanel();
      const logoutButton = e.target.closest("[data-logout]"); if (logoutButton) return logout();
      const messageProfile = e.target.closest("[data-message-profile]"); if (messageProfile) return openMessages(messageProfile.dataset.messageProfile);
      const deleteConversationButton = e.target.closest("[data-delete-conversation]"); if (deleteConversationButton) { e.preventDefault(); e.stopPropagation(); return deleteMessageConversation(deleteConversationButton.dataset.deleteConversation); }
      const messageUser = e.target.closest("[data-message-user]"); if (messageUser) return openMessageThread(messageUser.dataset.messageUser);
      const markNotifications = e.target.closest("[data-mark-notifications]"); if (markNotifications) { await api("/api/notifications/read", { method: "POST" }); state.notifications.forEach(n => n.read=true); renderNotifications(); await loadNavCounts(); return; }

      const action = e.target.closest("[data-action]");
      if (action) {
        const { action: a, id } = action.dataset;
        if (a === "menu") { e.stopPropagation(); const menu = $(`[data-menu-for="${id}"]`); const wasHidden = menu?.classList.contains("hidden"); closePostMenus(); if (menu && wasHidden) menu.classList.remove("hidden"); return; }
        closePostMenus();
        if (a === "like") return toggleLike(id);
        if (a === "repost-menu") return openRepostMenu(action.dataset.kind || "post", id);
        if (a === "comment-like") return toggleCommentLike(id);
        if (a === "comment-edit") return openEditComment(id);
        if (a === "comment-delete") return deleteOwnComment(id);
        if (a === "reply-comment") { const c=findComment(id); if (c) { if (!modalVisible("commentsModal")) await openComments(c.parentPostId); insertAtCursor($("#commentText"), `@${c.author.username} `); } return; }
        if (a === "comment-share") { try { await navigator.clipboard.writeText(`${location.origin}/#comment-${id}`); toast("Lien copié.","success"); } catch { toast("Impossible de copier le lien.","error"); } return; }
        if (a === "comments") return openComments(id);
        if (a === "edit") return openEditPost(id);
        if (a === "delete") return deleteOwnPost(id);
        if (a === "share") { try { await navigator.clipboard.writeText(`${location.origin}/#post-${id}`); toast("Lien copié.", "success"); } catch { toast("Impossible de copier le lien.", "error"); } return; }
      } else { closePostMenus(); }

      const profileTab = e.target.closest("[data-profile-tab]"); if (profileTab) return switchProfileTab(profileTab.dataset.profileTab);
      const openConversation = e.target.closest("[data-open-conversation]"); if (openConversation) return openComments(openConversation.dataset.openConversation);

      const rm = e.target.closest("[data-remove-file]"); if (rm) { state[rm.dataset.fileTarget].splice(Number(rm.dataset.removeFile), 1); renderFilePreview(rm.dataset.fileTarget); return; }
      const suggestion = e.target.closest("[data-follow-suggestion]"); if (suggestion) return followUsername(suggestion.dataset.followSuggestion);
      const tag = e.target.closest("[data-search-tag]"); if (tag) { e.preventDefault(); return openSearchResults(tag.dataset.searchTag, "top"); }
      const animationScore = e.target.closest("[data-animation-score]"); if (animationScore) return rateAnimationTarget(animationScore.dataset.animationKind, animationScore.dataset.animationId, animationScore.dataset.animationScore);
      const verified = e.target.closest("[data-admin-verified]"); if (verified) return adminUpdateUser(verified.dataset.adminVerified, { isVerified: verified.dataset.nextVerified === "true" });
      const trainerRole = e.target.closest("[data-admin-trainer]"); if (trainerRole) return adminUpdateUser(trainerRole.dataset.adminTrainer, { isTrainer: trainerRole.dataset.nextTrainer === "true" });
      const role = e.target.closest("[data-admin-role]"); if (role) return adminUpdateUser(role.dataset.adminRole, { isAdmin: role.dataset.nextAdmin === "true" });
      const active = e.target.closest("[data-admin-active]"); if (active) return adminUpdateUser(active.dataset.adminActive, { isActive: active.dataset.nextActive === "true" });
      const modDelete = e.target.closest("[data-admin-delete-post]"); if (modDelete) return adminDeletePost(modDelete.dataset.adminDeletePost);
      const emojiButton = e.target.closest("[data-emoji-target]"); if (emojiButton) { e.preventDefault(); e.stopPropagation(); return openEmojiPicker(emojiButton.dataset.emojiTarget, emojiButton); }
      const gifButton = e.target.closest("[data-gif-target]"); if (gifButton) { e.preventDefault(); return openGifPicker(gifButton.dataset.gifTarget); }
      const emojiCategory = e.target.closest("[data-emoji-category]"); if (emojiCategory) { e.preventDefault(); return renderEmojiPicker(emojiCategory.dataset.emojiCategory); }
      const emoji = e.target.closest("[data-emoji]"); if (emoji) { e.preventDefault(); insertAtCursor(composerTarget(state.emojiTarget).textarea, emoji.dataset.emoji); return; }
      const giphyResult = e.target.closest("[data-giphy-result]"); if (giphyResult) { e.preventDefault(); return addGiphyResult(giphyResult.dataset.giphyResult); }
      const decorTool = e.target.closest("[data-decor-tool]"); if (decorTool) return toast(`${decorTool.dataset.decorTool} : fonctionnalité prévue pour une version ultérieure.`);

      if (!e.target.closest("#emojiPopover") && !e.target.closest("[data-emoji-target]")) closeEmojiPicker();
      if (e.target.closest("[data-close-media]")) return closeMediaModal();
      if (e.target.closest("[data-close-gif]")) return closeGifPicker();
      if (e.target.closest("[data-close-repost]")) { $("#repostModal").classList.add("hidden"); state.repostTarget=null; return; }
      if (e.target.closest("[data-close-quote]")) { $("#quoteModal").classList.add("hidden"); state.quoteTarget=null; return; }
      if (e.target.closest("[data-close-comments]")) return $("#commentsModal").classList.add("hidden");
      if (e.target.closest("[data-close-edit]")) return $("#editProfileModal").classList.add("hidden");
      if (e.target.closest("[data-close-post-edit]")) { $("#editPostModal").classList.add("hidden"); state.editingPostId = null; return; }
      if (e.target.closest("[data-close-comment-edit]")) { $("#editCommentModal").classList.add("hidden"); state.editingCommentId = null; return; }
      if (e.target.closest("[data-close-animation]")) return $("#animationModal").classList.add("hidden");
      if (e.target.closest("[data-close-admin]")) return $("#adminModal").classList.add("hidden");
      if (e.target.closest("[data-close-connections]")) return $("#connectionsModal").classList.add("hidden");
      if (e.target.id === "backHome") return home();
      if (e.target.id === "profileFollowButton") return followUsername(state.currentProfile.username);
      if (e.target.id === "editProfileButton") return openEditProfile();
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && !$("#mediaModal")?.classList.contains("hidden")) return closeMediaModal();
      if (!["Enter", " "].includes(e.key)) return;
      const mediaOpen = e.target.closest?.("[data-media-open]");
      if (mediaOpen) { e.preventDefault(); openMediaModal(mediaOpen); }
    });

    $("#loginButton").addEventListener("click", () => openAuth("login"));
    $("#registerTopButton")?.addEventListener("click", () => openAuth("register"));
    $("#tweetButton").addEventListener("click", () => { if (!requireAuth()) return; home(); $("#composerText").focus(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    $("#brandHome").addEventListener("click", () => home()); $("#headerAvatar").addEventListener("click", () => state.me && openProfile(state.me.username));
    $("#refreshFeed").addEventListener("click", loadFeed); $("#refreshSuggestions").addEventListener("click", loadSuggestions); $("#refreshTrends")?.addEventListener("click", loadTrends);
    $("#composerFiles").addEventListener("change", e => filesFromInput(e.target, "composerFiles")); $("#sendPost").addEventListener("click", sendPost);
    $("#commentFiles").addEventListener("change", e => filesFromInput(e.target, "commentFiles")); $("#sendComment").addEventListener("click", sendComment);
    $("#saveCommentEdit")?.addEventListener("click", saveCommentEdit);
    $("#quoteFiles").addEventListener("change", e => filesFromInput(e.target, "quoteFiles")); $("#sendQuote").addEventListener("click", sendQuote);
    $("#repostDirect").addEventListener("click", executeRepost); $("#repostQuote").addEventListener("click", openQuoteComposer);
    $("#saveProfile").addEventListener("click", saveProfile); $("#savePostEdit").addEventListener("click", savePostEdit);
    $("#editAvatarPreview").addEventListener("click", e => { if (!e.target.closest("label,input")) $("#editAvatar").click(); });
    $("#searchInput").addEventListener("input", e => scheduleSearchSuggestions(e.target.value));
    $("#searchInput").addEventListener("focus", e => { if (e.target.value.trim()) scheduleSearchSuggestions(e.target.value); });
    $("#searchInput").addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); const q = e.currentTarget.value.trim(); if (q) openSearchResults(q, "top"); }
      if (e.key === "Escape") closeSearchSuggestions();
    });
    $("#searchClear").addEventListener("click", () => { $("#searchInput").value = ""; updateSearchClear(); closeSearchSuggestions(); $("#searchInput").focus(); });
    $("#animationContent").addEventListener("submit", e => { if (e.target.id === "animationSearchForm") { e.preventDefault(); const fd=new FormData(e.target); state.animation.q=String(fd.get("q")||"").trim(); state.animation.kind=String(fd.get("kind")||"all"); loadAnimationTargets(); } });
    $("#animationContent").addEventListener("change", e => { if (e.target.name === "kind" && e.target.closest("#animationSearchForm")) { state.animation.kind=e.target.value; const q=e.target.closest("form")?.elements?.q?.value||""; state.animation.q=q.trim(); loadAnimationTargets(); } });
    $("#adminContent").addEventListener("input", e => { if (e.target.id === "adminUserSearch") renderAdminPanel(e.target.value); });
    $("#adminContent").addEventListener("submit", e => { if (e.target.id === "adminCreateUserForm") { e.preventDefault(); adminCreateUser(e.target); } });
    $("#searchFiltersCard").addEventListener("change", e => {
      if (e.target.name === "searchPeople") { state.search.people = e.target.value; loadSearchResults(); }
      if (e.target.name === "searchLocation") { state.search.location = e.target.value; loadSearchResults(); }
    });
    $("#messagesPanel").addEventListener("submit", e => {
      if (e.target.id === "newMessageForm") { e.preventDefault(); const username = new FormData(e.target).get("username"); openMessageThread(username); }
      if (e.target.id === "privateMessageForm") { e.preventDefault(); sendPrivateMessage(e.target); }
    });
    $("#gifSearchForm").addEventListener("submit", e => { e.preventDefault(); const query = $("#gifSearchInput").value.trim(); if (query) loadGiphyResults(query); else loadGiphyResults(""); });

    $("#editAvatar").addEventListener("change", async e => { const f = e.target.files[0]; if (!f) return; state.editAvatar = await readFile(f); setEditableAvatar({ avatarUrl: state.editAvatar.data }); });
    $("#editBanner").addEventListener("change", async e => { const f = e.target.files[0]; if (!f) return; state.editBanner = await readFile(f); $("#editBannerPreview").style.backgroundImage = `url("${state.editBanner.data}")`; });

    $("#loginForm").addEventListener("submit", async e => {
      e.preventDefault(); const fd = new FormData(e.target);
      try { const data = await api("/api/login", { method: "POST", body: Object.fromEntries(fd) }); state.token = data.token; localStorage.setItem("tfiatter_token", data.token); closeAuth(); await loadMe(); await Promise.all([loadGiphyConfig(), loadFeed(), loadSuggestions(), loadTrends()]); toast(`Bienvenue ${state.me.displayName}.`, "success"); }
      catch (err) { toast(err.message, "error"); }
    });

    $("#registerForm").addEventListener("submit", async e => {
      e.preventDefault(); const fd = new FormData(e.target);
      try { const data = await api("/api/register", { method: "POST", body: Object.fromEntries(fd) }); state.token = data.token; localStorage.setItem("tfiatter_token", data.token); closeAuth(); await loadMe(); await Promise.all([loadGiphyConfig(), loadFeed(), loadSuggestions(), loadTrends()]); toast("Compte créé. Bienvenue sur TFI@TTER !", "success"); }
      catch (err) { toast(err.message, "error"); }
    });

    $$(".nav-link").forEach(btn => btn.addEventListener("click", () => {
      if (btn.dataset.nav === "home") return home();
      if (btn.dataset.nav === "notifications") return openNotifications();
      if (btn.dataset.nav === "messages") return openMessages();
      setNavActive(btn.dataset.nav); toast(`${btn.textContent.trim()} : écran décoratif dans cette version.`);
    }));
  }

  async function init() {
    hydrateIcons(); bindEvents(); await loadMe();
    const jobs = [loadFeed(), loadTrends()];
    if (state.me) jobs.push(loadGiphyConfig(), loadSuggestions());
    await Promise.all(jobs);
    if (state.me) scheduleGiphyHydration();
    startPolling();
  }

  init();
})();
