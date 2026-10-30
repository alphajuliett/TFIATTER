module.exports = {
  uiPort: process.env.PORT || 1880,
  flowFile: process.env.FLOWS || "flows.json",
  credentialSecret: process.env.NODE_RED_CREDENTIAL_SECRET || process.env.JWT_SECRET || "tfiatter-local-secret",
  httpAdminRoot: "/red",
  httpNodeRoot: "/",
  httpStatic: "/data/public",
  disableEditor: false,
  apiMaxLength: "40mb",
  functionExternalModules: true,
  functionGlobalContext: {
    tfi: require("/data/lib/tfiatter")
  },
  editorTheme: {
    projects: { enabled: false },
    page: { title: "TFI@TTER · Node-RED" },
    header: { title: "TFI@TTER · Node-RED" }
  },
  logging: {
    console: {
      level: "info",
      metrics: false,
      audit: false
    }
  }
};
