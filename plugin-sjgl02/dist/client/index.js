var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);

// src/client/plugin.tsx
var import_client = require("@nocobase/client");
var import_react = __toESM(require("react"));
var import_antd = require("antd");
var import_icons = require("@ant-design/icons");
var { Dragger } = import_antd.Upload;
var VERSION = "v1.0.24";
function apiRequest(client, url, opts = {}) {
  if (!client || !client.request) {
    console.warn("[sjgl02] apiRequest: client not ready for", url);
    return Promise.reject(new Error("Client not ready"));
  }
  const method = (opts.method || "get").toLowerCase();
  return client.request({ url, method, data: opts.data, params: opts.params }).then((res) => res?.data?.data ?? res?.data ?? null).catch((err) => {
    console.error("[sjgl02] API error:", url, err?.response?.status);
    return Promise.reject(err);
  });
}
function Sjgl02SettingsPageV1() {
  return /* @__PURE__ */ import_react.default.createElement("div", { style: { maxWidth: 1280, margin: "0 auto" } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { background: "linear-gradient(135deg,#1677ff,#0958d9)", borderRadius: 12, padding: "14px 24px", color: "#fff", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 18, fontWeight: 600 } }, "\u{1F4CA} \u6570\u636E\u7BA1\u7406"), /* @__PURE__ */ import_react.default.createElement("div", { style: { opacity: 0.8, fontSize: 12, marginTop: 2 } }, "\u5BFC\u5165\u5BFC\u51FA \xB7 \u4EFB\u52A1\u7BA1\u7406 \xB7 \u8868\u7EA7\u6743\u9650\u63A7\u5236")), /* @__PURE__ */ import_react.default.createElement("div", { style: { background: "rgba(255,255,255,0.2)", borderRadius: 20, padding: "4px 14px", fontSize: 11 } }, "@my-project/plugin-sjgl02 ", VERSION)), /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { style: { borderRadius: 10, minHeight: 500 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Tabs, { defaultActiveKey: "import", destroyInactiveTabPane: true, items: [
    { key: "import", label: "\u2B07 \u5BFC\u5165", children: /* @__PURE__ */ import_react.default.createElement(ImportPanel, null) },
    { key: "export", label: "\u2B06 \u5BFC\u51FA", children: /* @__PURE__ */ import_react.default.createElement(ExportPanel, null) },
    { key: "tasks", label: "\u2630 \u4EFB\u52A1\u7BA1\u7406", children: /* @__PURE__ */ import_react.default.createElement(TaskPanel, null) },
    { key: "permissions", label: "\u2713 \u6743\u9650\u7BA1\u7406", children: /* @__PURE__ */ import_react.default.createElement(PermissionPanel, null) }
  ] })));
}
function ImportPanel() {
  const client = (0, import_client.useAPIClient)();
  const [step, setStep] = import_react.default.useState(0);
  const [selectedTable, setSelectedTable] = import_react.default.useState(null);
  const [importMode, setImportMode] = import_react.default.useState("insert");
  const [uploadedFileId, setUploadedFileId] = import_react.default.useState(null);
  const [uploadedFileName, setUploadedFileName] = import_react.default.useState("");
  const [tableFields, setTableFields] = import_react.default.useState([]);
  const [previewData, setPreviewData] = import_react.default.useState(null);
  const [uniqueFields, setUniqueFields] = import_react.default.useState([]);
  const [fieldMapping, setFieldMapping] = import_react.default.useState({});
  const [customValues, setCustomValues] = import_react.default.useState({});
  const [excelHeaders, setExcelHeaders2] = import_react.default.useState([]);
  const [sheetName, setSheetName2] = import_react.default.useState("Sheet1");
  const [headerRow, setHeaderRow] = import_react.default.useState(1);
  const [availSheets, setAvailSheets2] = import_react.default.useState(["Sheet1"]);
  const [tables, setTables] = import_react.default.useState([]);
  const [loading, setLoading] = import_react.default.useState(true);
  import_react.default.useEffect(() => {
    apiRequest(client, "sjgl02Permissions:tables").then((data) => {
      if (Array.isArray(data)) {
        setTables(data.map((t) => ({ name: t.name, title: t.title || t.name })));
      }
    }).catch(() => import_antd.message.error("\u52A0\u8F7D\u8868\u5217\u8868\u5931\u8D25")).finally(() => setLoading(false));
  }, []);
  import_react.default.useEffect(() => {
    if (selectedTable?.name) {
      client.request({ url: "sjgl02Import:tableFields", method: "get", params: { tableName: selectedTable.name } }).then((res) => {
        const fields = res?.data?.data || [];
        setTableFields(Array.isArray(fields) ? fields : []);
      }).catch(() => {
      });
    }
  }, [selectedTable?.name]);
  const handleFileSelect = (info) => {
    if (info.file.status === "done") {
      const resp = info.file.response;
      const fileId = resp?.id;
      if (fileId) {
        setUploadedFileId(fileId);
        setUploadedFileName(info.file.name);
        import_antd.message.success(`${info.file.name} \u4E0A\u4F20\u6210\u529F`);
        client.request({ url: "sjgl02Import:uploadParse", method: "post", data: { fileId } }).then((pr) => {
          const pd = pr?.data?.data;
          if (pd?.headerColumns) setExcelHeaders2(pd.headerColumns);
          if (pd?.sheets) {
            setAvailSheets2(pd.sheets);
            if (pd.sheets[0]) setSheetName2(pd.sheets[0]);
          }
        }).catch(() => {
          setExcelHeaders2([]);
          setAvailSheets2(["Sheet1"]);
        });
      } else {
        import_antd.message.error("\u4E0A\u4F20\u54CD\u5E94\u4E2D\u672A\u627E\u5230\u6587\u4EF6ID");
      }
    } else if (info.file.status === "error") {
      import_antd.message.error("\u4E0A\u4F20\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
    }
  };
  const handlePreview = () => {
    if (!uploadedFileId) return;
    client.request({
      url: "sjgl02Import:preview",
      method: "get",
      params: { fileId: uploadedFileId, sheetName, headerRow }
    }).then((res) => {
      setPreviewData(res?.data?.data || null);
    }).catch((err) => {
      const msg = err?.response?.data?.errors?.[0]?.message || err?.message || "\u9884\u89C8\u5931\u8D25";
      import_antd.message.error(msg);
    });
  };
  const handleAutoMatch = () => {
    const mapping = {};
    tableFields.forEach((f) => {
      const match = excelHeaders.find(
        (h) => h === f.name || h.toLowerCase() === f.name.toLowerCase()
      );
      if (match) mapping[f.name] = match;
    });
    setFieldMapping(mapping);
    import_antd.message.success("\u81EA\u52A8\u5339\u914D\u5B8C\u6210");
  };
  const handleExecute = () => {
    import_antd.Modal.confirm({
      title: "\u786E\u8BA4\u5BFC\u5165",
      content: "\u5BFC\u5165\u5728\u4E8B\u52A1\u4E2D\u6267\u884C\uFF0C\u4EFB\u4E00\u884C\u5931\u8D25\u5219\u6574\u6279\u56DE\u6EDA\u3002\u5173\u8054\u5B57\u6BB5\u901A\u8FC7\u4E3B\u952EID\u5339\u914D\uFF0C\u5339\u914D\u5931\u8D25\u5219\u6574\u6279\u56DE\u6EDA\u3002",
      onOk: () => {
        client.request({
          url: "sjgl02Import:execute",
          method: "post",
          data: {
            tableName: selectedTable?.name,
            fileId: uploadedFileId,
            sheetName,
            headerRow,
            fieldMapping,
            customValues,
            importMode,
            uniqueFields
          }
        }).then(() => {
          import_antd.message.success("\u5BFC\u5165\u4EFB\u52A1\u5DF2\u63D0\u4EA4\uFF0C\u53EF\u5728\u4EFB\u52A1\u7BA1\u7406\u4E2D\u67E5\u770B\u8FDB\u5EA6");
          setStep(0);
          setSelectedTable(null);
          setUploadedFileId(null);
          setUploadedFileName("");
          setFieldMapping({});
          setPreviewData(null);
          setCustomValues({});
          setExcelHeaders2([]);
          setAvailSheets2(["Sheet1"]);
        }).catch(() => import_antd.message.error("\u63D0\u4EA4\u5931\u8D25"));
      }
    });
  };
  return /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement(import_antd.Steps, { current: step, items: [{ title: "\u9009\u62E9\u6570\u636E\u8868" }, { title: "\u4E0A\u4F20\u6587\u4EF6 & \u5B57\u6BB5\u6620\u5C04" }, { title: "\u9884\u89C8 & \u6267\u884C" }], style: { marginBottom: 24 } }), step === 0 && /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement(import_antd.Row, { gutter: 16 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 12 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { title: "\u{1F4CB} \u9009\u62E9\u76EE\u6807\u6570\u636E\u8868", size: "small" }, /* @__PURE__ */ import_react.default.createElement(
    import_antd.Select,
    {
      style: { width: "100%" },
      placeholder: "\u2014 \u8BF7\u9009\u62E9\u6570\u636E\u8868 \u2014",
      loading,
      showSearch: true,
      value: selectedTable?.name || void 0,
      onChange: (val) => setSelectedTable(tables.find((t) => t.name === val) || null),
      filterOption: (input, option) => String(option?.label || "").toLowerCase().includes(input.toLowerCase()),
      options: tables.map((t) => ({ value: t.name, label: `\u{1F4C1} ${t.title} (${t.name})` }))
    }
  ), /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 11, color: "#999", marginTop: 4 } }, "\u5171 ", tables.length, " \u5F20\u8868"))), /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 12 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { title: "\u2139\uFE0F \u5BFC\u5165\u8BF4\u660E", size: "small" }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 13, color: "#666", lineHeight: 1.9 } }, /* @__PURE__ */ import_react.default.createElement("p", null, "\u2022 \u652F\u6301 ", /* @__PURE__ */ import_react.default.createElement("strong", null, ".xlsx"), " / ", /* @__PURE__ */ import_react.default.createElement("strong", null, ".xls"), " / ", /* @__PURE__ */ import_react.default.createElement("strong", null, ".csv")), /* @__PURE__ */ import_react.default.createElement("p", null, "\u2022 \u6587\u4EF6\u6700\u5927 ", /* @__PURE__ */ import_react.default.createElement("strong", null, "50 MB")), /* @__PURE__ */ import_react.default.createElement("p", null, "\u2022 \u4E09\u79CD\u6A21\u5F0F\uFF1A", /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "blue" }, "\u65B0\u589E"), " ", /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "green" }, "\u66F4\u65B0"), " ", /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "orange" }, "\u65B0\u589E+\u66F4\u65B0")))))), /* @__PURE__ */ import_react.default.createElement("div", { style: { textAlign: "right", marginTop: 12 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { type: "primary", disabled: !selectedTable, onClick: () => setStep(1) }, "\u4E0B\u4E00\u6B65 \u2192"))), step === 1 && /* @__PURE__ */ import_react.default.createElement("div", null, !uploadedFileId ? /* @__PURE__ */ import_react.default.createElement(
    Dragger,
    {
      name: "file",
      multiple: false,
      accept: ".xlsx,.xls,.csv",
      customRequest: ({ file, onSuccess, onError }) => {
        const fd = new FormData();
        fd.append("file", file);
        client.request({ url: "attachments:create", method: "post", data: fd }).then((r) => {
          const d = r?.data?.data ?? r?.data;
          onSuccess({ id: d?.id, ...d }, file);
        }).catch(onError);
      },
      onChange: handleFileSelect,
      beforeUpload: (file) => {
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!["xlsx", "xls", "csv"].includes(ext || "")) {
          import_antd.message.error("\u4E0D\u652F\u6301\u7684\u6587\u4EF6\u683C\u5F0F");
          return import_antd.Upload.LIST_IGNORE;
        }
        if (file.size > 50 * 1024 * 1024) {
          import_antd.message.error("\u6587\u4EF6\u8D85\u8FC7 50MB \u9650\u5236");
          return import_antd.Upload.LIST_IGNORE;
        }
        return true;
      },
      style: { marginBottom: 20 }
    },
    /* @__PURE__ */ import_react.default.createElement("p", { className: "ant-upload-drag-icon" }, /* @__PURE__ */ import_react.default.createElement(import_icons.InboxOutlined, null)),
    /* @__PURE__ */ import_react.default.createElement("p", { className: "ant-upload-text" }, "\u70B9\u51FB\u6216\u62D6\u62FD\u4E0A\u4F20\u6587\u4EF6"),
    /* @__PURE__ */ import_react.default.createElement("p", { className: "ant-upload-hint" }, "\u652F\u6301 .xlsx / .xls / .csv\uFF0C\u6700\u5927 50MB")
  ) : /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small", style: { marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "blue" }, uploadedFileName), /* @__PURE__ */ import_react.default.createElement(
    import_antd.Button,
    {
      size: "small",
      style: { marginLeft: 8 },
      onClick: () => {
        setUploadedFileId(null);
        setUploadedFileName("");
        setExcelHeaders2([]);
        setFieldMapping({});
      }
    },
    "\u91CD\u65B0\u4E0A\u4F20"
  ), /* @__PURE__ */ import_react.default.createElement(import_antd.Space, { style: { marginLeft: 16 } }, /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#999" } }, "Sheet\uFF1A"), /* @__PURE__ */ import_react.default.createElement(
    import_antd.Select,
    {
      value: sheetName,
      onChange: setSheetName2,
      style: { width: 120 },
      options: availSheets.map((s) => ({ value: s, label: s }))
    }
  ), /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#999" } }, "\u8868\u5934\u884C\uFF1A"), /* @__PURE__ */ import_react.default.createElement(import_antd.InputNumber, { min: 1, max: 100, value: headerRow, onChange: (v) => setHeaderRow(v || 1), style: { width: 70 } }))), /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small", style: { marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Space, null, /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#999" } }, "\u5BFC\u5165\u6A21\u5F0F\uFF1A"), /* @__PURE__ */ import_react.default.createElement(
    import_antd.Select,
    {
      value: importMode,
      onChange: setImportMode,
      style: { width: 220 },
      options: [
        { value: "insert", label: "\u65B0\u589E (insert)" },
        { value: "update", label: "\u66F4\u65B0 (update)" },
        { value: "upsert", label: "\u65B0\u589E+\u66F4\u65B0 (upsert)" }
      ]
    }
  ))), (importMode === "update" || importMode === "upsert") && /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small", style: { marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, color: "#fa8c16", marginBottom: 8 } }, "\u{1F511} \u552F\u4E00\u503C\u5B57\u6BB5"), /* @__PURE__ */ import_react.default.createElement(
    import_antd.Select,
    {
      mode: "multiple",
      value: uniqueFields,
      onChange: setUniqueFields,
      style: { width: "100%" },
      placeholder: "\u9009\u62E9\u552F\u4E00\u503C\u5B57\u6BB5",
      options: tableFields.map((f) => ({ value: f.name, label: (f.uiSchema?.title || f.name) + "(" + f.name + ")" }))
    }
  )), excelHeaders.length > 0 && /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small", title: /* @__PURE__ */ import_react.default.createElement("span", null, "\u{1F4CA} \u5B57\u6BB5\u6620\u5C04\uFF08", tableFields.length, "\u5B57\u6BB5/\u5DF2\u6620\u5C04", Object.values(fieldMapping).filter((v) => v && v !== "__ignore__").length, "\uFF09", /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { size: "small", style: { marginLeft: 12 }, onClick: handleAutoMatch }, "\u26A1 \u81EA\u52A8\u5339\u914D")), style: { marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement(
    import_antd.Table,
    {
      dataSource: tableFields.map((f, i) => ({ field: f, key: i })),
      columns: [
        {
          title: "Excel\u5217 / \u81EA\u5B9A\u4E49\u503C",
          width: 220,
          render: (record) => {
            const val = fieldMapping[record.field.name];
            const isCustom = val === "__custom__";
            const used = Object.values(fieldMapping).filter((v) => v && v !== "__ignore__" && v !== "__custom__");
            return /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement(
              import_antd.Select,
              {
                style: { width: "100%" },
                placeholder: "\u5FFD\u7565",
                value: val || void 0,
                onChange: (v) => setFieldMapping((prev) => ({ ...prev, [record.field.name]: v })),
                allowClear: true
              },
              /* @__PURE__ */ import_react.default.createElement(import_antd.Select.Option, { value: "__ignore__" }, "\u{1F6AB} \u5FFD\u7565"),
              /* @__PURE__ */ import_react.default.createElement(import_antd.Select.Option, { value: "__custom__" }, "\u270F\uFE0F \u81EA\u5B9A\u4E49\u56FA\u5B9A\u503C"),
              excelHeaders.map((h) => /* @__PURE__ */ import_react.default.createElement(import_antd.Select.Option, { key: h, value: h, disabled: used.includes(h) && val !== h }, h, used.includes(h) && val !== h ? " (\u5DF2\u7528)" : ""))
            ), isCustom && /* @__PURE__ */ import_react.default.createElement(
              import_antd.Input,
              {
                size: "small",
                style: { marginTop: 4 },
                placeholder: "\u8F93\u5165\u56FA\u5B9A\u503C",
                value: customValues[record.field.name] || "",
                onChange: (e) => setCustomValues((prev) => ({ ...prev, [record.field.name]: e.target.value }))
              }
            ));
          }
        },
        { title: "\u2192", width: 30, render: () => /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#999" } }, "\u2192") },
        {
          title: "\u6620\u5C04\u65B9\u5F0F",
          width: 80,
          render: (record) => {
            const val = fieldMapping[record.field.name];
            if (!val || val === "__ignore__") return /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, null, "\u5FFD\u7565");
            if (val === "__custom__") return /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "green" }, "\u56FA\u5B9A\u503C");
            return /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "blue" }, "Excel\u5217");
          }
        },
        { title: "\u2192", width: 30, render: () => /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#999" } }, "\u2192") },
        {
          title: "\u5DE5\u4F5C\u8868\u5B57\u6BB5",
          width: 150,
          render: (record) => /* @__PURE__ */ import_react.default.createElement("span", null, record.field.isRequired && /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#ff4d4f" } }, "* "), record.field.uiSchema?.title || record.field.name, "(", record.field.name, ")", uniqueFields.includes(record.field.name) && /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "orange", style: { marginLeft: 4, fontSize: 10 } }, "\u{1F511} \u552F\u4E00\u503C"))
        }
      ],
      pagination: false,
      size: "small"
    }
  ))), /* @__PURE__ */ import_react.default.createElement("div", { style: { textAlign: "right", marginTop: 12 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { onClick: () => setStep(0), style: { marginRight: 8 } }, "\u2190 \u4E0A\u4E00\u6B65"), /* @__PURE__ */ import_react.default.createElement(
    import_antd.Button,
    {
      type: "primary",
      disabled: (() => {
        if (!uploadedFileId) return true;
        if (importMode === "insert") return false;
        if (uniqueFields.length === 0) return true;
        if (uniqueFields.some((uf) => !fieldMapping[uf] || fieldMapping[uf] === "__ignore__" || fieldMapping[uf] === "__custom__")) return true;
        return false;
      })(),
      onClick: async () => {
        await handlePreview();
        setStep(2);
      }
    },
    "\u4E0B\u4E00\u6B65 \u2192"
  ))), step === 2 && /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, fontSize: 14, marginBottom: 16 } }, "\u9884\u89C8\u786E\u8BA4 \u2014 ", selectedTable?.title || selectedTable?.name), /* @__PURE__ */ import_react.default.createElement(import_antd.Row, { gutter: 12, style: { marginBottom: 16 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 6 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Statistic, { title: "\u9884\u8BA1\u5BFC\u5165\u884C\u6570", value: previewData?.totalRows || 0 }))), /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 6 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Statistic, { title: "\u9519\u8BEF\u884C\u6570", value: 0, valueStyle: { color: "#52c41a" } }))), /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 6 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Statistic, { title: "\u5BFC\u5165\u6A21\u5F0F", value: importMode === "insert" ? "\u65B0\u589E" : importMode === "update" ? "\u66F4\u65B0" : importMode === "upsert" ? "\u65B0\u589E+\u66F4\u65B0" : importMode }))), /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 6 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Statistic, { title: "Sheet\u540D\u79F0", value: sheetName })))), /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small", style: { marginBottom: 16 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Row, { gutter: 12 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 12 }, /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#666" } }, "\u{1F4C4} \u4E0A\u4F20\u6587\u4EF6\uFF1A"), /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "blue" }, uploadedFileName)), /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 12 }, /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#666" } }, "\u{1F4CB} \u8868\u5934\u884C\uFF1A"), /* @__PURE__ */ import_react.default.createElement("span", null, headerRow))), /* @__PURE__ */ import_react.default.createElement("div", { style: { marginTop: 8 } }, /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#666" } }, "\u{1F4CA} \u76EE\u6807\u5DE5\u4F5C\u8868\uFF1A"), /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "blue" }, selectedTable?.title || selectedTable?.name, " (", selectedTable?.name, ")")), uniqueFields.length > 0 && /* @__PURE__ */ import_react.default.createElement("div", { style: { marginTop: 8 } }, /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#666" } }, "\u{1F511} \u552F\u4E00\u503C\u5B57\u6BB5\uFF1A"), /* @__PURE__ */ import_react.default.createElement(import_antd.Space, { wrap: true }, uniqueFields.map((f) => /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { key: f, color: "orange" }, f)))), Object.values(customValues).some((v) => v) && /* @__PURE__ */ import_react.default.createElement("div", { style: { marginTop: 8 } }, /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#666" } }, "\u270F\uFE0F \u81EA\u5B9A\u4E49\u56FA\u5B9A\u503C\uFF1A"), /* @__PURE__ */ import_react.default.createElement(import_antd.Space, { wrap: true }, Object.entries(customValues).filter(([, v]) => v).map(([k, v]) => /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { key: k, color: "green" }, k, ": ", v))))), /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, marginBottom: 8 } }, "\u{1F441}\uFE0F \u9884\u89C8\u6570\u636E\uFF08\u524D10\u884C\uFF09"), previewData?.preview ? /* @__PURE__ */ import_react.default.createElement(
    import_antd.Table,
    {
      dataSource: previewData.preview.map((r, i) => {
        const row = { key: i };
        Object.entries(fieldMapping).forEach(([fieldName, excelCol]) => {
          if (excelCol === "__custom__") {
            row[fieldName] = customValues[fieldName] || "";
          } else if (excelCol && excelCol !== "__ignore__") {
            row[excelCol] = r[excelCol] !== void 0 ? r[excelCol] : "";
          }
        });
        return row;
      }),
      columns: (() => {
        const cols = [];
        const seen = /* @__PURE__ */ new Set();
        const titles = {};
        tableFields.forEach((f) => {
          titles[f.name] = f.uiSchema?.title || f.name;
        });
        Object.entries(fieldMapping).forEach(([fieldName, excelCol]) => {
          const disp = titles[fieldName] || fieldName;
          if (excelCol === "__custom__") {
            cols.push({ title: "\u81EA\u5B9A\u4E49-" + disp + "(" + fieldName + ")", dataIndex: fieldName });
          } else if (excelCol && excelCol !== "__ignore__" && !seen.has(excelCol)) {
            seen.add(excelCol);
            cols.push({ title: excelCol + "-" + disp + "(" + fieldName + ")", dataIndex: excelCol });
          }
        });
        return cols;
      })(),
      pagination: false,
      size: "small"
    }
  ) : /* @__PURE__ */ import_react.default.createElement(import_antd.Empty, { description: "\u6682\u65E0\u9884\u89C8\u6570\u636E\uFF0C\u8BF7\u8FD4\u56DE\u4E0A\u4E00\u6B65\u4E0A\u4F20\u6587\u4EF6" }), /* @__PURE__ */ import_react.default.createElement("div", { style: { textAlign: "right", marginTop: 16 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { onClick: () => setStep(1), style: { marginRight: 8 } }, "\u2190 \u4E0A\u4E00\u6B65"), /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { type: "primary", onClick: handleExecute, disabled: !previewData }, "\u25B6 \u6267\u884C\u5BFC\u5165"))));
}
function ExportPanel() {
  const client = (0, import_client.useAPIClient)();
  const [step, setStep] = import_react.default.useState(0);
  const [tables, setTables] = import_react.default.useState([]);
  const [selTable, setSelTable] = import_react.default.useState("");
  const [isAllTables, setIsAllTables] = import_react.default.useState(false);
  const [loading, setLoading] = import_react.default.useState(true);
  const [fields, setFields] = import_react.default.useState([]);
  const [selFields, setSelFields] = import_react.default.useState([]);
  const [fileName, setFileName] = import_react.default.useState("{\u8868\u540D}_{\u65E5\u671F}.xlsx");
  const [exporting, setExporting] = import_react.default.useState(false);
  const [progress, setProgress] = import_react.default.useState(0);
  const [done, setDone] = import_react.default.useState(false);
  const [taskId, setTaskId] = import_react.default.useState(null);
  const [includeAssocSheet, setIncludeAssocSheet] = import_react.default.useState(false);
  const [selectedAssocTables, setSelectedAssocTables] = import_react.default.useState([]);
  const [estimatedRows, setEstimatedRows] = import_react.default.useState(null);
  import_react.default.useEffect(() => {
    apiRequest(client, "sjgl02Permissions:tables").then((data) => {
      if (Array.isArray(data)) {
        setTables(data.map((t) => ({ name: t.name, title: t.title || t.name })));
      }
    }).catch(() => {
    }).finally(() => setLoading(false));
  }, []);
  import_react.default.useEffect(() => {
    if (selTable && selTable !== "__all__") {
      client.request({ url: "sjgl02Export:tableFields", method: "get", params: { tableName: selTable } }).then((res) => {
        const fArr = res?.data?.data || [];
        if (Array.isArray(fArr)) {
          setFields(fArr.map((f) => ({ ...f, displayName: f.name })));
          setSelFields(fArr.map((f) => f.name));
        }
      }).catch(() => {
      });
      client.request({ url: "sjgl02Export:previewCount", method: "post", data: { tableName: selTable } }).then((res) => {
        const c = res?.data?.data?.estimatedRows;
        if (typeof c === "number") setEstimatedRows(c);
      }).catch(() => {
      });
    } else if (selTable === "__all__") {
      client.request({ url: "sjgl02Export:previewCount", method: "post", data: { tableName: "__all__" } }).then((res) => {
        const c = res?.data?.data?.estimatedRows;
        if (typeof c === "number") setEstimatedRows(c);
      }).catch(() => {
      });
    }
  }, [selTable]);
  const toggleField = (name) => setSelFields((p) => p.includes(name) ? p.filter((f) => f !== name) : [...p, name]);
  const regular = fields.filter((f) => !["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(f.type) && !f.isForeignKey);
  const assoc = fields.filter((f) => ["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(f.type));
  const fkFields = fields.filter((f) => f.isForeignKey);
  const handleExport = () => {
    import_antd.Modal.confirm({
      title: "\u786E\u8BA4\u5BFC\u51FA",
      content: isAllTables ? "\u5C06\u5BFC\u51FA\u5168\u90E8\u6570\u636E\u8868\uFF0C\u4EFB\u52A1\u5728\u540E\u53F0\u5F02\u6B65\u6267\u884C" : "\u5C06\u751F\u6210 .xlsx \u6587\u4EF6\uFF0C\u4EFB\u52A1\u5728\u540E\u53F0\u5F02\u6B65\u6267\u884C",
      onOk: async () => {
        try {
          await client.request({
            url: "sjgl02Export:execute",
            method: "post",
            data: {
              tableName: selTable,
              selectedFields: isAllTables ? [] : selFields,
              fileNameTemplate: fileName,
              includeAssociationSheet: includeAssocSheet,
              associationSheetTables: selectedAssocTables
            }
          });
          import_antd.message.success("\u5BFC\u51FA\u4EFB\u52A1\u5DF2\u63D0\u4EA4\uFF0C\u8BF7\u5728\u4EFB\u52A1\u7BA1\u7406\u4E2D\u67E5\u770B\u8FDB\u5EA6\u548C\u4E0B\u8F7D");
          setStep(0);
        } catch {
          import_antd.message.error("\u63D0\u4EA4\u5931\u8D25");
        }
      }
    });
  };
  return /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement(import_antd.Steps, { current: step, items: [{ title: "\u9009\u62E9\u6570\u636E\u8868" }, { title: "\u9009\u62E9\u5B57\u6BB5 & \u914D\u7F6E" }, { title: "\u6267\u884C\u5BFC\u51FA" }], style: { marginBottom: 24 } }), step === 0 && /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement(import_antd.Row, { gutter: 16 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 12 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { title: "\u{1F4CB} \u9009\u62E9\u6570\u636E\u8868", size: "small" }, /* @__PURE__ */ import_react.default.createElement(
    import_antd.Select,
    {
      style: { width: "100%" },
      placeholder: "\u2014 \u8BF7\u9009\u62E9\u6570\u636E\u8868 \u2014",
      loading,
      showSearch: true,
      value: selTable || void 0,
      onChange: (val) => {
        setSelTable(val);
        setIsAllTables(val === "__all__");
      },
      filterOption: (input, option) => String(option?.label || "").toLowerCase().includes(input.toLowerCase()),
      options: [
        { value: "__all__", label: "\u{1F4E6} \u5168\u90E8\u6570\u636E\u8868\uFF08\u542B\u7CFB\u7EDF\u8868\uFF09" },
        ...tables.map((t) => ({ value: t.name, label: `\u{1F4C1} ${t.title} (${t.name})` }))
      ]
    }
  ), /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 11, color: "#999", marginTop: 4 } }, "\u5171 ", tables.length + 1, " \u4E2A\u9009\u9879"))), /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 12 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { title: "\u2699\uFE0F \u7B80\u8981\u914D\u7F6E", size: "small" }, /* @__PURE__ */ import_react.default.createElement("ul", { style: { color: "#666", paddingLeft: 16, fontSize: 13, lineHeight: 1.9 } }, /* @__PURE__ */ import_react.default.createElement("li", null, "\u652F\u6301\u5168\u5B57\u6BB5\u9009\u62E9\u548C\u81EA\u5B9A\u4E49\u7B5B\u9009"), /* @__PURE__ */ import_react.default.createElement("li", null, "\u5173\u8054\u5B57\u6BB5\u53EF\u9009\u300C\u663E\u793A\u503C\u300D\u6216\u300C\u4EC5ID\u300D"), /* @__PURE__ */ import_react.default.createElement("li", null, "\u81EA\u5B9A\u4E49\u6587\u4EF6\u540D\u6A21\u677F"))))), /* @__PURE__ */ import_react.default.createElement("div", { style: { textAlign: "right", marginTop: 12 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { type: "primary", disabled: !selTable, onClick: () => setStep(1) }, "\u4E0B\u4E00\u6B65 \u2192"))), step === 1 && /* @__PURE__ */ import_react.default.createElement("div", null, isAllTables ? /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { title: "\u{1F4E6} \u5168\u90E8\u6570\u636E\u8868\u5BFC\u51FA", size: "small", style: { marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement("p", null, "\u2705 \u5C06\u5BFC\u51FA\u7CFB\u7EDF\u4E2D\u6240\u6709\u6570\u636E\u8868\uFF0C\u6700\u7EC8\u6253\u5305\u4E3A ", /* @__PURE__ */ import_react.default.createElement("strong", null, "ZIP \u538B\u7F29\u5305")), /* @__PURE__ */ import_react.default.createElement("p", { style: { marginTop: 8 } }, "\u{1F4CB} \u5305\u542B\u4EE5\u4E0B ", tables.length, " \u5F20\u8868\uFF1A"), /* @__PURE__ */ import_react.default.createElement("div", { style: { maxHeight: 200, overflowY: "auto" } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Space, { wrap: true }, tables.map((t) => /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { key: t.name, color: "blue" }, t.title))))) : /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { title: "\u2611\uFE0F \u5B57\u6BB5\u9009\u62E9", size: "small", style: { marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { marginBottom: 8 } }, /* @__PURE__ */ import_react.default.createElement(
    import_antd.Checkbox,
    {
      indeterminate: selFields.length > 0 && selFields.length < fields.length,
      checked: selFields.length === fields.length && fields.length > 0,
      onChange: () => selFields.length === fields.length ? setSelFields([]) : setSelFields(fields.map((f) => f.name))
    },
    "\u5168\u9009 ",
    /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#999", fontSize: 12 } }, "\u5DF2\u9009: ", selFields.length, "/", fields.length)
  )), regular.length > 0 && /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, fontSize: 12, marginBottom: 6 } }, "\u{1F4C4} \u5E38\u89C4\u5B57\u6BB5 (", regular.length, ")"), /* @__PURE__ */ import_react.default.createElement(import_antd.Space, { wrap: true, style: { marginBottom: 12 } }, regular.map((f) => /* @__PURE__ */ import_react.default.createElement(import_antd.Checkbox, { key: f.name, checked: selFields.includes(f.name), onChange: () => toggleField(f.name) }, (f.uiSchema?.title || f.name) + "(" + f.name + ")")))), assoc.length > 0 && /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, fontSize: 12, color: "#7c3aed", marginBottom: 6 } }, "\u{1F517} \u5173\u8054\u5B57\u6BB5 (", assoc.length, ")"), /* @__PURE__ */ import_react.default.createElement(import_antd.Space, { wrap: true }, assoc.map((f) => /* @__PURE__ */ import_react.default.createElement(import_antd.Checkbox, { key: f.name, checked: selFields.includes(f.name), onChange: () => toggleField(f.name) }, (f.uiSchema?.title || f.name) + "(" + f.name + ")")))), fkFields.length > 0 && /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, fontSize: 12, color: "#d97706", marginBottom: 6 } }, "\u{1F511} \u5173\u8054\u4E3B\u952E (", fkFields.length, ")"), /* @__PURE__ */ import_react.default.createElement(import_antd.Space, { wrap: true }, fkFields.map((f) => /* @__PURE__ */ import_react.default.createElement(import_antd.Checkbox, { key: f.name, checked: selFields.includes(f.name), onChange: () => toggleField(f.name) }, (f.uiSchema?.title || f.name) + "(" + f.name + ")"))))), assoc.length > 0 && /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { title: "\u{1F4D1} \u5173\u8054\u6570\u636E Sheet", size: "small", style: { marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Space, null, /* @__PURE__ */ import_react.default.createElement(import_antd.Switch, { checked: includeAssocSheet, onChange: setIncludeAssocSheet }), /* @__PURE__ */ import_react.default.createElement("span", null, "\u5305\u542B\u5173\u8054\u6570\u636E Sheet")), includeAssocSheet && /* @__PURE__ */ import_react.default.createElement("div", { style: { marginTop: 8 } }, /* @__PURE__ */ import_react.default.createElement(
    import_antd.Select,
    {
      mode: "multiple",
      style: { width: "100%" },
      placeholder: "\u9009\u62E9\u8981\u5305\u542B\u7684\u5173\u8054\u8868",
      value: selectedAssocTables,
      onChange: setSelectedAssocTables,
      options: assoc.filter((f) => selFields.includes(f.name)).map((f) => ({ value: f.name, label: f.name }))
    }
  )))), /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { title: "\u2699\uFE0F \u9AD8\u7EA7\u9009\u9879", size: "small" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Space, { style: { marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#999" } }, "\u6587\u4EF6\u547D\u540D\u89C4\u5219\uFF1A"), /* @__PURE__ */ import_react.default.createElement(import_antd.Input, { style: { width: 280 }, value: fileName, onChange: (e) => setFileName(e.target.value) })), /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 11, color: "#999" } }, "\u652F\u6301 ", `{\u8868\u540D}`, " ", `{\u65E5\u671F}`, " \u5360\u4F4D\u7B26")), /* @__PURE__ */ import_react.default.createElement("div", { style: { textAlign: "right", marginTop: 12 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { onClick: () => setStep(0), style: { marginRight: 8 } }, "\u2190 \u4E0A\u4E00\u6B65"), /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { type: "primary", onClick: () => setStep(2), disabled: !selTable || !isAllTables && selFields.length === 0 }, "\u4E0B\u4E00\u6B65 \u2192"))), step === 2 && /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement(import_antd.Row, { gutter: 12, style: { marginBottom: 16 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 6 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Statistic, { title: "\u9009\u62E9\u5B57\u6BB5", value: isAllTables ? "\u5168\u90E8" : selFields.length }))), /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 6 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Statistic, { title: "\u9884\u8BA1\u884C\u6570", value: estimatedRows ?? "..." }))), /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 6 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Statistic, { title: "\u6587\u4EF6\u547D\u540D", value: fileName }))), /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 6 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Statistic, { title: "\u683C\u5F0F", value: isAllTables ? ".zip" : ".xlsx" })))), /* @__PURE__ */ import_react.default.createElement("div", { style: { textAlign: "right" } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { onClick: () => setStep(1), style: { marginRight: 8 } }, "\u2190 \u4E0A\u4E00\u6B65"), /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { type: "primary", onClick: handleExport }, "\u25B6 \u6267\u884C\u5BFC\u51FA"))));
}
function TaskPanel() {
  const client = (0, import_client.useAPIClient)();
  const [tasks, setTasks] = import_react.default.useState([]);
  const [loading, setLoading] = import_react.default.useState(true);
  const [taskType, setTaskType] = import_react.default.useState("all");
  const [status, setStatus] = import_react.default.useState("all");
  const [drawer, setDrawer] = import_react.default.useState(null);
  const [tableTitles, setTableTitles] = import_react.default.useState({});
  import_react.default.useEffect(() => {
    apiRequest(client, "sjgl02Permissions:tables").then((data) => {
      if (Array.isArray(data)) {
        const map = {};
        data.forEach((t) => {
          map[t.name] = t.title || t.name;
        });
        setTableTitles(map);
      }
    }).catch(() => {
    });
  }, []);
  const loadTasks = () => {
    setLoading(true);
    apiRequest(client, "sjgl02Tasks:list", { params: { taskType, status } }).then((data) => {
      if (data && Array.isArray(data.items)) {
        setTasks(data.items);
      } else {
        setTasks([]);
      }
    }).catch(() => setTasks([])).finally(() => setLoading(false));
  };
  import_react.default.useEffect(() => {
    loadTasks();
  }, [taskType, status]);
  import_react.default.useEffect(() => {
    const t = setInterval(loadTasks, 1e4);
    return () => clearInterval(t);
  }, [taskType, status]);
  const handleView = async (task) => {
    try {
      const res = await client.request({ url: "sjgl02Tasks:detail", method: "get", params: { taskId: task.id } });
      const t = res?.data?.data || task;
      const fileId = t.exportFileId || t.importFileId;
      if (fileId) {
        try {
          const att = await client.request({ url: "attachments:get", method: "get", params: { filterByTk: fileId } });
          t._fileName = att?.data?.data?.filename || att?.data?.data?.title || "";
        } catch {
          t._fileName = "";
        }
      }
      if (t.tableName) {
        try {
          const fd = await client.request({ url: "sjgl02Import:tableFields", method: "get", params: { tableName: t.tableName } });
          const fields = fd?.data?.data || [];
          const map = {};
          (Array.isArray(fields) ? fields : []).forEach((f) => {
            map[f.name] = f.uiSchema?.title || f.name;
          });
          t._fieldTitles = map;
        } catch {
          t._fieldTitles = {};
        }
      }
      setDrawer(t);
    } catch {
      setDrawer(task);
    }
  };
  const handleCancel = (task) => {
    import_antd.Modal.confirm({ title: "\u786E\u8BA4\u53D6\u6D88", content: "\u786E\u5B9A\u8981\u53D6\u6D88\u6B64\u4EFB\u52A1\u5417\uFF1F", onOk: async () => {
      await client.request({ url: "sjgl02Tasks:cancel", method: "post", data: { taskId: task.id } });
      import_antd.message.success("\u5DF2\u53D6\u6D88");
      loadTasks();
    } });
  };
  const statusColors = { pending: "orange", processing: "blue", completed: "green", failed: "red", cancelled: "default" };
  const statusLabels = { pending: "\u6392\u961F\u4E2D", processing: "\u8FDB\u884C\u4E2D", completed: "\u5DF2\u5B8C\u6210", failed: "\u5931\u8D25", cancelled: "\u5DF2\u53D6\u6D88" };
  return /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small", style: { marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Space, { wrap: true }, /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#666" } }, "\u7C7B\u578B\uFF1A"), /* @__PURE__ */ import_react.default.createElement(
    import_antd.Select,
    {
      value: taskType,
      onChange: setTaskType,
      style: { width: 100 },
      options: [{ value: "all", label: "\u5168\u90E8" }, { value: "import", label: "\u5BFC\u5165" }, { value: "export", label: "\u5BFC\u51FA" }]
    }
  ), /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#666" } }, "\u72B6\u6001\uFF1A"), /* @__PURE__ */ import_react.default.createElement(
    import_antd.Select,
    {
      value: status,
      onChange: setStatus,
      style: { width: 100 },
      options: [{ value: "all", label: "\u5168\u90E8" }, { value: "pending", label: "\u6392\u961F\u4E2D" }, { value: "processing", label: "\u8FDB\u884C\u4E2D" }, { value: "completed", label: "\u5DF2\u5B8C\u6210" }, { value: "failed", label: "\u5931\u8D25" }, { value: "cancelled", label: "\u5DF2\u53D6\u6D88" }]
    }
  ), /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { onClick: loadTasks }, "\u{1F504} \u5237\u65B0"))), /* @__PURE__ */ import_react.default.createElement(
    import_antd.Table,
    {
      loading,
      dataSource: tasks.map((t) => ({ ...t, key: t.id })),
      size: "small",
      pagination: { pageSize: 20 },
      columns: [
        { title: "\u4EFB\u52A1ID", dataIndex: "id", render: (v) => `#${v}` },
        { title: "\u7C7B\u578B", dataIndex: "taskType", render: (v) => /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: v === "import" ? "blue" : "green" }, v === "import" ? "\u5BFC\u5165" : "\u5BFC\u51FA") },
        { title: "\u76EE\u6807\u8868", dataIndex: "tableName", render: (v) => (tableTitles[v] || v) + "(" + v + ")" },
        { title: "\u72B6\u6001", dataIndex: "status", render: (v) => /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: statusColors[v] }, statusLabels[v] || v) },
        { title: "\u8FDB\u5EA6", dataIndex: "progress", render: (v) => /* @__PURE__ */ import_react.default.createElement(import_antd.Progress, { percent: v || 0, size: "small", style: { minWidth: 80 } }) },
        { title: "\u6570\u636E\u91CF", render: (_, r) => `${r.processedRows || 0}/${r.totalRows || 0}` },
        { title: "\u521B\u5EFA\u4EBA", dataIndex: ["createdBy", "nickname"], render: (v) => v || "\u2014" },
        { title: "\u521B\u5EFA\u65F6\u95F4", dataIndex: "createdAt", render: (v) => v ? new Date(v).toLocaleString() : "\u2014" },
        { title: "\u64CD\u4F5C", render: (_, r) => /* @__PURE__ */ import_react.default.createElement(import_antd.Space, null, /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { type: "link", size: "small", onClick: () => handleView(r) }, "\u{1F441} \u67E5\u770B"), ["pending", "processing"].includes(r.status) && /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { type: "link", size: "small", danger: true, onClick: () => handleCancel(r) }, "\u23F9 \u53D6\u6D88")) }
      ]
    }
  ), /* @__PURE__ */ import_react.default.createElement(import_antd.Drawer, { title: "\u4EFB\u52A1\u65E5\u5FD7", open: !!drawer, onClose: () => setDrawer(null), width: 680 }, drawer && (() => {
    const modeLabel = drawer.importMode === "insert" ? "\u65B0\u589E" : drawer.importMode === "update" ? "\u66F4\u65B0" : drawer.importMode === "upsert" ? "\u65B0\u589E+\u66F4\u65B0" : drawer.importMode;
    const fieldTitles = drawer._fieldTitles || {};
    return /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement(import_antd.Descriptions, { title: "\u4EFB\u52A1\u6458\u8981", column: 2, size: "small", bordered: true }, /* @__PURE__ */ import_react.default.createElement(import_antd.Descriptions.Item, { label: "\u4EFB\u52A1ID" }, "#", drawer.id), /* @__PURE__ */ import_react.default.createElement(import_antd.Descriptions.Item, { label: "\u7C7B\u578B" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: drawer.taskType === "import" ? "blue" : "green" }, drawer.taskType === "import" ? "\u5BFC\u5165" : "\u5BFC\u51FA")), /* @__PURE__ */ import_react.default.createElement(import_antd.Descriptions.Item, { label: "\u76EE\u6807\u8868" }, (tableTitles[drawer.tableName] || drawer.tableName) + "(" + drawer.tableName + ")"), /* @__PURE__ */ import_react.default.createElement(import_antd.Descriptions.Item, { label: "\u72B6\u6001" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: statusColors[drawer.status] }, statusLabels[drawer.status])), /* @__PURE__ */ import_react.default.createElement(import_antd.Descriptions.Item, { label: "\u521B\u5EFA\u4EBA" }, drawer.createdBy?.nickname || "\u2014"), /* @__PURE__ */ import_react.default.createElement(import_antd.Descriptions.Item, { label: "\u6570\u636E\u91CF" }, drawer.processedRows || 0, "/", drawer.totalRows || 0), drawer.taskType === "import" && /* @__PURE__ */ import_react.default.createElement(import_antd.Descriptions.Item, { label: "Sheet\u540D\u79F0" }, drawer.sheetName || "\u2014"), drawer.taskType === "import" && /* @__PURE__ */ import_react.default.createElement(import_antd.Descriptions.Item, { label: "\u5BFC\u5165\u6A21\u5F0F" }, modeLabel), drawer.taskType === "import" && /* @__PURE__ */ import_react.default.createElement(import_antd.Descriptions.Item, { label: "\u552F\u4E00\u503C\u5B57\u6BB5" }, drawer.uniqueFields?.length > 0 ? drawer.uniqueFields.join(", ") : "\u2014"), /* @__PURE__ */ import_react.default.createElement(import_antd.Descriptions.Item, { label: "\u521B\u5EFA\u65F6\u95F4" }, drawer.createdAt ? new Date(drawer.createdAt).toLocaleString() : "\u2014"), /* @__PURE__ */ import_react.default.createElement(import_antd.Descriptions.Item, { label: "\u5B8C\u6210\u65F6\u95F4" }, drawer.completedAt ? new Date(drawer.completedAt).toLocaleString() : "\u2014"), /* @__PURE__ */ import_react.default.createElement(import_antd.Descriptions.Item, { label: "\u6587\u4EF6\u540D" }, drawer._fileName ? /* @__PURE__ */ import_react.default.createElement(import_antd.Space, { size: 4 }, /* @__PURE__ */ import_react.default.createElement("span", null, drawer._fileName), drawer.importFileId && /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { type: "link", size: "small", onClick: () => window.open("/api/attachments:download/" + drawer.importFileId) }, "\u2B07 \u4E0B\u8F7D\u5BFC\u5165\u6E90\u6587\u4EF6"), drawer.exportFileId && /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { type: "link", size: "small", onClick: () => {
      client.request({ url: "sjgl02Export:download", method: "get", params: { taskId: drawer.id }, responseType: "blob" }).then((res) => {
        const disp = res.headers?.["content-disposition"] || "";
        const m = disp.match(/filename\*=UTF-8''(.+)|filename="?([^";]+)/);
        const name = m ? decodeURIComponent(m[1] || m[2] || "export.xlsx") : "export.xlsx";
        const url = URL.createObjectURL(res.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      }).catch(() => import_antd.message.error("\u4E0B\u8F7D\u5931\u8D25"));
    } }, "\u2B07 \u4E0B\u8F7D\u5BFC\u51FA\u6587\u4EF6")) : "\u2014")), drawer.errorMessage && /* @__PURE__ */ import_react.default.createElement("div", { style: { background: "#fff2f0", border: "1px solid #ffccc7", padding: "12px 16px", borderRadius: 6, margin: "16px 0" } }, "\u274C \u9519\u8BEF\u4FE1\u606F\uFF1A", drawer.errorMessage), drawer.status === "completed" && drawer.taskType === "import" && /* @__PURE__ */ import_react.default.createElement("div", { style: { background: "#f6ffed", border: "1px solid #b7eb8f", padding: "12px 16px", borderRadius: 6, margin: "16px 0" } }, "\u2705 \u5BFC\u5165\u6210\u529F\uFF1A\u5171 ", drawer.totalRows, " \u884C\uFF0C\u6210\u529F\u5BFC\u5165 ", drawer.processedRows, " \u884C"), drawer.fieldMapping && Object.keys(drawer.fieldMapping).length > 0 && /* @__PURE__ */ import_react.default.createElement("div", { style: { marginTop: 16 } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, marginBottom: 8 } }, "\u{1F4CA} \u5B57\u6BB5\u6620\u5C04"), /* @__PURE__ */ import_react.default.createElement(
      import_antd.Table,
      {
        dataSource: Object.entries(drawer.fieldMapping).filter(([, v]) => v && v !== "__ignore__").map(([k, v], i) => ({
          key: i,
          field: (fieldTitles[k] || k) + "(" + k + ")",
          type: v === "__custom__" ? "\u56FA\u5B9A\u503C\u5199\u5165" : "Excel\u5217",
          value: v === "__custom__" ? "\uFF08\u672A\u5B58\u50A8\uFF09" : v
        })),
        columns: [
          { title: "\u5DE5\u4F5C\u8868\u5B57\u6BB5", dataIndex: "field" },
          { title: "\u6620\u5C04\u65B9\u5F0F", width: 90, render: (_, r) => r.type === "\u56FA\u5B9A\u503C\u5199\u5165" ? /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "green" }, "\u56FA\u5B9A\u503C\u5199\u5165") : /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "blue" }, "Excel\u5217") },
          { title: "\u2192", width: 30 },
          { title: "Excel\u5217/\u56FA\u5B9A\u503C", dataIndex: "value" }
        ],
        pagination: false,
        size: "small"
      }
    )), drawer.taskType === "export" && drawer.tableName === "__all__" && /* @__PURE__ */ import_react.default.createElement("div", { style: { marginTop: 16 } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, marginBottom: 8 } }, "\u{1F4E6} \u5168\u90E8\u6570\u636E\u8868\u5BFC\u51FA"), /* @__PURE__ */ import_react.default.createElement("div", { style: { color: "#666", fontSize: 13 } }, "\u5171 ", drawer.totalRows || 0, " \u5F20\u8868\uFF0C\u5BFC\u51FA ", drawer.processedRows || 0, " \u884C\u6570\u636E")), drawer.taskType === "export" && drawer.tableName !== "__all__" && drawer.selectedFields && drawer.selectedFields.length > 0 && /* @__PURE__ */ import_react.default.createElement("div", { style: { marginTop: 16 } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, marginBottom: 8 } }, "\u{1F4CB} \u5BFC\u51FA\u5B57\u6BB5\u9009\u62E9"), /* @__PURE__ */ import_react.default.createElement(import_antd.Space, { wrap: true }, drawer.selectedFields.map((f) => /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { key: f, color: "blue" }, (fieldTitles[f] || f) + "(" + f + ")")))), drawer.taskType === "export" && drawer.includeAssociationSheet && drawer.associationSheetTables && drawer.associationSheetTables.length > 0 && /* @__PURE__ */ import_react.default.createElement("div", { style: { marginTop: 16 } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, marginBottom: 8 } }, "\u{1F4D1} \u5173\u8054\u6570\u636E Sheet\uFF08", drawer.associationSheetTables.length, "\u4E2A\uFF09"), /* @__PURE__ */ import_react.default.createElement(import_antd.Space, { wrap: true }, drawer.associationSheetTables.map((f) => /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { key: f, color: "purple" }, (fieldTitles[f] || f) + "(" + f + ")")))), drawer.errorLogs?.length > 0 && /* @__PURE__ */ import_react.default.createElement("div", { style: { marginTop: 16 } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, marginBottom: 8 } }, "\u274C \u9519\u8BEF\u65E5\u5FD7 (", drawer.errorLogs.length, "\u6761)"), /* @__PURE__ */ import_react.default.createElement(
      import_antd.Table,
      {
        dataSource: drawer.errorLogs.map((l, i) => ({ ...l, key: i })),
        columns: [{ title: "\u884C\u53F7", dataIndex: "row", width: 60 }, { title: "Excel\u884C", dataIndex: "excelRow", width: 60 }, { title: "\u539F\u56E0", dataIndex: "reason" }, { title: "\u5FEB\u7167", dataIndex: "snapshot", render: (v) => v ? String(v).substring(0, 200) : "\u2014" }],
        pagination: false,
        size: "small"
      }
    )), !drawer.errorMessage && (!drawer.fieldMapping || Object.keys(drawer.fieldMapping).length === 0) && (!drawer.selectedFields || drawer.selectedFields.length === 0) && (!drawer.errorLogs || drawer.errorLogs.length === 0) && /* @__PURE__ */ import_react.default.createElement(import_antd.Empty, { description: "\u6682\u65E0\u8BE6\u7EC6\u65E5\u5FD7", style: { marginTop: 16 } }));
  })()));
}
function PermissionPanel() {
  const client = (0, import_client.useAPIClient)();
  const [targets, setTargets] = import_react.default.useState([]);
  const [selTarget, setSelTarget] = import_react.default.useState(null);
  const [perms, setPerms] = import_react.default.useState([]);
  const [viewScope, setViewScope] = import_react.default.useState("own");
  const [modal, setModal] = import_react.default.useState({ open: false });
  const [form] = import_antd.Form.useForm();
  const [tables, setTables] = import_react.default.useState([]);
  const [modalFields, setModalFields] = import_react.default.useState([]);
  import_react.default.useEffect(() => {
    apiRequest(client, "sjgl02Permissions:userRoleList").then((data) => {
      if (data) {
        const users = (data.users || []).map((u) => ({ ...u, type: "user" }));
        const roles = (data.roles || []).map((r) => ({ id: r.id, nickname: r.title || r.name, name: r.name, type: "role" }));
        setTargets([...users, ...roles]);
      }
    }).catch(() => {
    });
    apiRequest(client, "sjgl02Permissions:tables").then((data) => {
      if (Array.isArray(data)) {
        setTables(data.map((t) => ({ name: t.name, title: t.title || t.name })));
      }
    }).catch(() => {
    });
  }, []);
  import_react.default.useEffect(() => {
    if (selTarget) {
      client.request({ url: "sjgl02Permissions:get", method: "get", params: { targetType: selTarget.type, targetId: selTarget.id } }).then((res) => {
        const p = res?.data?.data;
        setPerms(Array.isArray(p) ? p : []);
      }).catch(() => setPerms([]));
    }
  }, [selTarget]);
  const togglePerm = (tableName, field) => {
    setPerms((p) => p.map((x) => x.tableName === tableName ? { ...x, [field]: !x[field] } : x));
  };
  const deletePerm = (tableName) => setPerms((p) => p.filter((x) => x.tableName !== tableName));
  const savePermsRef = import_react.default.useRef(false);
  import_react.default.useEffect(() => {
    if (!savePermsRef.current) {
      savePermsRef.current = true;
      return;
    }
    client.request({ url: "sjgl02Permissions:save", method: "post", data: { permissions: perms } }).catch(() => {
    });
  }, [perms]);
  const savePerms = async () => {
    try {
      await client.request({ url: "sjgl02Permissions:save", method: "post", data: { permissions: perms } });
      import_antd.message.success("\u4FDD\u5B58\u6210\u529F");
      setModal({ open: false });
    } catch {
      import_antd.message.error("\u4FDD\u5B58\u5931\u8D25");
    }
  };
  const userTargets = targets.filter((t) => t.type === "user");
  const roleTargets = targets.filter((t) => t.type === "role");
  return /* @__PURE__ */ import_react.default.createElement(import_antd.Row, { gutter: 20 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 6 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small", style: { maxHeight: 500, overflow: "auto" } }, [{ label: "\u{1F464} \u7528\u6237", items: userTargets, color: "#1677ff" }, { label: "\u{1F465} \u89D2\u8272", items: roleTargets, color: "#52c41a" }].map((group) => /* @__PURE__ */ import_react.default.createElement("div", { key: group.label }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 11, color: "#999", padding: "8px 8px 4px", fontWeight: 600 } }, group.label, " (", group.items.length, ")"), group.items.map((t) => /* @__PURE__ */ import_react.default.createElement(
    "div",
    {
      key: `${t.type}-${t.id}`,
      onClick: () => {
        setSelTarget(t);
        setPerms([]);
      },
      style: {
        padding: "8px 10px",
        borderRadius: 6,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        marginBottom: 2,
        background: selTarget?.id === t.id && selTarget?.type === t.type ? "#e6f4ff" : void 0,
        color: selTarget?.id === t.id && selTarget?.type === t.type ? "#1677ff" : void 0
      }
    },
    /* @__PURE__ */ import_react.default.createElement("div", { style: { width: 28, height: 28, borderRadius: "50%", background: group.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12 } }, t.type === "user" ? "U" : "R"),
    /* @__PURE__ */ import_react.default.createElement("span", null, t.nickname || t.name)
  )))))), /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 18 }, !selTarget ? /* @__PURE__ */ import_react.default.createElement(import_antd.Card, null, /* @__PURE__ */ import_react.default.createElement(import_antd.Empty, { description: "\u8BF7\u9009\u62E9\u5DE6\u4FA7\u7528\u6237\u6216\u89D2\u8272" })) : /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small", style: { marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Space, { style: { width: "100%", justifyContent: "space-between" } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Space, null, /* @__PURE__ */ import_react.default.createElement("div", { style: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 600,
    fontSize: 12,
    background: selTarget.type === "user" ? "#1677ff" : "#52c41a"
  } }, selTarget.type === "user" ? "U" : "R"), /* @__PURE__ */ import_react.default.createElement("strong", null, selTarget.nickname || selTarget.name), /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: selTarget.type === "user" ? "blue" : "green" }, selTarget.type === "user" ? "\u7528\u6237" : "\u89D2\u8272")), /* @__PURE__ */ import_react.default.createElement(import_antd.Space, null, /* @__PURE__ */ import_react.default.createElement("span", { style: { fontSize: 12, color: "#666" } }, "\u4EFB\u52A1\u67E5\u770B\u8303\u56F4\uFF1A"), /* @__PURE__ */ import_react.default.createElement(import_antd.Radio.Group, { value: viewScope, onChange: (e) => setViewScope(e.target.value), size: "small" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Radio.Button, { value: "own" }, "\u4EC5\u67E5\u770B\u81EA\u5DF1\u7684"), /* @__PURE__ */ import_react.default.createElement(import_antd.Radio.Button, { value: "all" }, "\u67E5\u770B\u5168\u90E8")), /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { type: "primary", size: "small", onClick: () => {
    form.resetFields();
    setModal({ open: true });
  } }, "+ \u6DFB\u52A0\u6743\u9650")))), perms.length === 0 ? /* @__PURE__ */ import_react.default.createElement(import_antd.Empty, { description: "\u6682\u65E0\u6743\u9650\u914D\u7F6E" }) : perms.map((p) => /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { key: p.tableName, size: "small", style: { marginBottom: 8 } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Space, null, /* @__PURE__ */ import_react.default.createElement("strong", null, p.tableName), /* @__PURE__ */ import_react.default.createElement(import_antd.Switch, { checkedChildren: "\u5BFC\u5165", unCheckedChildren: "\u5BFC\u5165", checked: p.canImport, onChange: () => togglePerm(p.tableName, "canImport") }), /* @__PURE__ */ import_react.default.createElement(import_antd.Switch, { checkedChildren: "\u5BFC\u51FA", unCheckedChildren: "\u5BFC\u51FA", checked: p.canExport, onChange: () => togglePerm(p.tableName, "canExport") })), /* @__PURE__ */ import_react.default.createElement(import_antd.Space, null, /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { size: "small", onClick: () => {
    form.setFieldsValue(p);
    setModal({ open: true, perm: p });
    client.request({ url: "sjgl02Import:tableFields", method: "get", params: { tableName: p.tableName } }).then((res) => {
      const fields = res?.data?.data || [];
      setModalFields(Array.isArray(fields) ? fields.map((f) => f.name) : []);
    }).catch(() => {
      setExcelHeaders([]);
      setAvailSheets([]);
      setSheetName("");
    });
  } }, "\u7F16\u8F91"), /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { size: "small", danger: true, onClick: () => deletePerm(p.tableName) }, "\u5220\u9664"))), /* @__PURE__ */ import_react.default.createElement(import_antd.Space, { wrap: true }, /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: p.canImport ? "blue" : "default" }, "\u5BFC\u5165: ", p.canImport ? "\u662F" : "\u5426"), /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: p.canExport ? "green" : "default" }, "\u5BFC\u51FA: ", p.canExport ? "\u662F" : "\u5426"), /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "orange" }, "\u6A21\u5F0F: ", p.importMode || "insert"), p.uniqueFields?.length > 0 && /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "orange" }, "\u552F\u4E00\u503C: ", p.uniqueFields.join(",")), p.requiredFields?.length > 0 && /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "red" }, "\u5FC5\u586B: ", p.requiredFields.join(","))))))), /* @__PURE__ */ import_react.default.createElement(import_antd.Modal, { title: modal.perm ? "\u7F16\u8F91\u6743\u9650" : "\u6DFB\u52A0\u6743\u9650", open: modal.open, onCancel: () => setModal({ open: false }), onOk: savePerms, width: 720 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Form, { form, layout: "vertical" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Form.Item, { label: "\u9009\u62E9\u6570\u636E\u8868", name: "tableName", rules: [{ required: true }] }, /* @__PURE__ */ import_react.default.createElement(
    import_antd.Select,
    {
      showSearch: true,
      options: tables.map((t) => ({ value: t.name, label: `${t.title} (${t.name})` })),
      onChange: (val) => {
        if (val) {
          client.request({ url: "sjgl02Import:tableFields", method: "get", params: { tableName: val } }).then((res) => {
            const fields = res?.data?.data || [];
            setModalFields(Array.isArray(fields) ? fields.map((f) => f.name) : []);
          }).catch(() => setModalFields([]));
        } else setModalFields([]);
      }
    }
  )), /* @__PURE__ */ import_react.default.createElement(import_antd.Space, { style: { marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Form.Item, { label: "\u5141\u8BB8\u5BFC\u5165", name: "canImport", valuePropName: "checked" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Switch, null)), /* @__PURE__ */ import_react.default.createElement(import_antd.Form.Item, { label: "\u5141\u8BB8\u5BFC\u51FA", name: "canExport", valuePropName: "checked" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Switch, null))), /* @__PURE__ */ import_react.default.createElement(import_antd.Form.Item, { label: "\u5BFC\u5165\u6A21\u5F0F", name: "importMode" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Select, { options: [{ value: "insert", label: "\u65B0\u589E (insert)" }, { value: "update", label: "\u66F4\u65B0 (update)" }, { value: "upsert", label: "\u65B0\u589E+\u66F4\u65B0 (upsert)" }] })), /* @__PURE__ */ import_react.default.createElement(import_antd.Form.Item, { label: "\u552F\u4E00\u503C\u5B57\u6BB5", name: "uniqueFields" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Select, { mode: "multiple", placeholder: "\u9009\u62E9\u552F\u4E00\u503C\u5B57\u6BB5", options: modalFields.map((v) => ({ value: v, label: v })) })), /* @__PURE__ */ import_react.default.createElement(import_antd.Form.Item, { label: "\u5FC5\u586B\u5B57\u6BB5", name: "requiredFields" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Select, { mode: "multiple", placeholder: "\u9009\u62E9\u5FC5\u586B\u5B57\u6BB5", options: modalFields.map((v) => ({ value: v, label: v })) })), /* @__PURE__ */ import_react.default.createElement(import_antd.Form.Item, { label: "\u53EF\u5BFC\u5165\u5B57\u6BB5", name: "importFields" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Select, { mode: "multiple", placeholder: "\u7A7A=\u5168\u90E8\u5141\u8BB8", options: modalFields.map((v) => ({ value: v, label: v })) })), /* @__PURE__ */ import_react.default.createElement(import_antd.Form.Item, { label: "\u53EF\u5BFC\u51FA\u5B57\u6BB5", name: "exportFields" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Select, { mode: "multiple", placeholder: "\u7A7A=\u5168\u90E8\u5141\u8BB8", options: modalFields.map((v) => ({ value: v, label: v })) })))));
}
function Sjgl02Block() {
  return /* @__PURE__ */ import_react.default.createElement("div", { style: { padding: 16 } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { background: "linear-gradient(135deg,#1677ff,#0958d9)", borderRadius: 10, padding: "10px 20px", color: "#fff", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, fontSize: 16 } }, "\u{1F4CA} \u6570\u636E\u7BA1\u7406"), /* @__PURE__ */ import_react.default.createElement("div", { style: { opacity: 0.7, fontSize: 11 } }, "@my-project/plugin-sjgl02 ", VERSION)), /* @__PURE__ */ import_react.default.createElement(import_antd.Tabs, { destroyInactiveTabPane: true, items: [
    { key: "import", label: "\u2B07 \u5BFC\u5165", children: /* @__PURE__ */ import_react.default.createElement(ImportPanel, null) },
    { key: "export", label: "\u2B06 \u5BFC\u51FA", children: /* @__PURE__ */ import_react.default.createElement(ExportPanel, null) },
    { key: "ta