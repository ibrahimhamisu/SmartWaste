// translations.js
// A lightweight i18n system. Any element with data-i18n="key" gets its text
// replaced based on the selected language. Elements with data-i18n-placeholder
// get their placeholder attribute translated instead.
//
// To translate more pages later: add the key/text pairs below, then add
// data-i18n="thatKey" to the HTML element. That's the whole pattern.

const TRANSLATIONS = {
  en: {
    appName: "SmartWaste",
    tagline: "Smart Reporting. Cleaner Communities.",
    welcomeBack: "Welcome back",
    signInSub: "Sign in to continue reporting or managing waste in your community.",
    resident: "Resident",
    admin: "Admin",
    email: "Email",
    password: "Password",
    forgotPassword: "Forgot password?",
    signIn: "Sign In",
    noAccount: "Don't have an account?",
    signUp: "Sign up",
    createAccount: "Create your account",
    signUpSub: "Join your community and start reporting waste issues.",
    fullName: "Full name",
    createAccountBtn: "Create Account",
    alreadyHaveAccount: "Already have an account?",
    home: "Home",
    reports: "Reports",
    map: "Map",
    profile: "Profile",
    keepClean: "Keep your community clean",
    reportIssue: "Report an Issue",
    reportIssueSub: "See waste, illegal dumping, or other problem?",
    reportWaste: "Report Waste",
    reportDumping: "Report Illegal Dumping",
    myReports: "My Reports",
    mapView: "Map View",
    quickStats: "Quick Stats",
    total: "Total",
    pending: "Pending",
    inProgress: "In progress",
    resolved: "Resolved",
    logout: "Logout",
    editProfile: "Edit Profile",
    darkMode: "Dark mode",
    fontSize: "Font size",
    language: "Language",
    notifications: "Notifications",
    pushNotifications: "Push Notifications",
    manageUsers: "Manage Users",
    changePassword: "Change password",
    privacyPolicy: "Privacy Policy",
    termsConditions: "Terms & Conditions",
    aboutApp: "About SmartWaste"
  },
  ha: {
    appName: "SmartWaste",
    tagline: "Rahoto Mai Sauri. Al'umma Mai Tsafta.",
    welcomeBack: "Barka da dawowa",
    signInSub: "Shiga don ci gaba da bayar da rahoto ko sarrafa shara a al'ummarka.",
    resident: "Mazauni",
    admin: "Admin",
    email: "Imel",
    password: "Password",
    forgotPassword: "Ka manta password?",
    signIn: "Shiga",
    noAccount: "Ba ka da account?",
    signUp: "Yi rijista",
    createAccount: "Kirkiro account ɗinka",
    signUpSub: "Shiga al'ummarka ka fara bayar da rahoton matsalar shara.",
    fullName: "Cikakken suna",
    createAccountBtn: "Kirkiro Account",
    alreadyHaveAccount: "Ka riga ka da account?",
    home: "Gida",
    reports: "Rahotanni",
    map: "Taswira",
    profile: "Profile",
    keepClean: "Ka tsaftace al'ummarka",
    reportIssue: "Bayar da Rahoton Matsala",
    reportIssueSub: "Ka ga shara, illegal dumping, ko wata matsala?",
    reportWaste: "Bayar da Rahoton Shara",
    reportDumping: "Bayar da Rahoton Illegal Dumping",
    myReports: "Rahotanni Na",
    mapView: "Duba Taswira",
    quickStats: "Takaitaccen Bayani",
    total: "Duka",
    pending: "Ana jira",
    inProgress: "Ana aiki",
    resolved: "An gama",
    logout: "Fita",
    editProfile: "Gyara Profile",
    darkMode: "Yanayin duhu",
    fontSize: "Girman rubutu",
    language: "Harshe",
    notifications: "Sanarwa",
    pushNotifications: "Sanarwa ta wayar hannu",
    manageUsers: "Sarrafa Users",
    changePassword: "Canza Password",
    privacyPolicy: "Manufar Sirri",
    termsConditions: "Sharuɗɗa",
    aboutApp: "Game da SmartWaste"
  }
};

function applyLanguage() {
  const lang = localStorage.getItem('sw_lang') || 'en';
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key]) el.setAttribute('placeholder', dict[key]);
  });

  document.documentElement.setAttribute('lang', lang === 'ha' ? 'ha' : 'en');
  return lang;
}

function setLanguage(lang) {
  localStorage.setItem('sw_lang', lang === 'ha' ? 'ha' : 'en');
  applyLanguage();
}

document.addEventListener('DOMContentLoaded', applyLanguage);
