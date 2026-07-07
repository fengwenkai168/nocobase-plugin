import type { ImportTableItem } from './importTypes';

export interface ImportState {
  step: number;
  selectedTable: ImportTableItem | null;
  importMode: string;
  allowedModes: string[];
  uploadedFileId: number | null;
  uploadedFileName: string;
  tableFields: any[];
  previewData: any;
  uniqueFields: string[];
  fieldMapping: Record<string, string>;
  customValues: Record<string, string>;
  excelHeaders: string[];
  sheetName: string;
  headerRow: number;
  availSheets: string[];
  previewModal: boolean;
  blankCellMode: string;
  previewMeta: any;
  permUniqueFields: string[];
  permRequiredFields: string[];
  permImportFields: string[];
  autoMatchFlag: boolean;
  matchInfo: string;
}

export type ImportAction =
  | { type: 'SET_STEP'; payload: number }
  | { type: 'SET_SELECTED_TABLE'; payload: ImportTableItem | null }
  | { type: 'SET_IMPORT_MODE'; payload: string }
  | { type: 'SET_ALLOWED_MODES'; payload: string[] }
  | { type: 'SET_UPLOADED_FILE'; payload: { id: number | null; name: string } }
  | { type: 'SET_TABLE_FIELDS'; payload: any[] }
  | { type: 'SET_PREVIEW_DATA'; payload: any }
  | { type: 'SET_UNIQUE_FIELDS'; payload: string[] }
  | { type: 'SET_FIELD_MAPPING'; payload: Record<string, string> }
  | { type: 'SET_CUSTOM_VALUES'; payload: Record<string, string> }
  | { type: 'SET_EXCEL_HEADERS'; payload: string[] }
  | { type: 'SET_SHEET_NAME'; payload: string }
  | { type: 'SET_HEADER_ROW'; payload: number }
  | { type: 'SET_AVAIL_SHEETS'; payload: string[] }
  | { type: 'SET_PREVIEW_MODAL'; payload: boolean }
  | { type: 'SET_BLANK_CELL_MODE'; payload: string }
  | { type: 'SET_PREVIEW_META'; payload: any }
  | { type: 'SET_PERM_FIELDS'; payload: { unique: string[]; required: string[]; importFields: string[] } }
  | { type: 'SET_AUTO_MATCH_FLAG'; payload: boolean }
  | { type: 'SET_MATCH_INFO'; payload: string }
  | { type: 'RESET_FILE_STATE' };

export const initialState: ImportState = {
  step: 0,
  selectedTable: null,
  importMode: 'insert',
  allowedModes: ['insert', 'update', 'upsert'],
  uploadedFileId: null,
  uploadedFileName: '',
  tableFields: [],
  previewData: null,
  uniqueFields: [],
  fieldMapping: {},
  customValues: {},
  excelHeaders: [],
  sheetName: '',
  headerRow: 1,
  availSheets: [],
  previewModal: false,
  blankCellMode: 'update',
  previewMeta: null,
  permUniqueFields: [],
  permRequiredFields: [],
  permImportFields: [],
  autoMatchFlag: false,
  matchInfo: '',
};

export function importReducer(state: ImportState, action: ImportAction): ImportState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload };
    case 'SET_SELECTED_TABLE':
      return { ...state, selectedTable: action.payload };
    case 'SET_IMPORT_MODE':
      return { ...state, importMode: action.payload };
    case 'SET_ALLOWED_MODES':
      return { ...state, allowedModes: action.payload };
    case 'SET_UPLOADED_FILE':
      return { ...state, uploadedFileId: action.payload.id, uploadedFileName: action.payload.name };
    case 'SET_TABLE_FIELDS':
      return { ...state, tableFields: action.payload };
    case 'SET_PREVIEW_DATA':
      return { ...state, previewData: action.payload };
    case 'SET_UNIQUE_FIELDS':
      return { ...state, uniqueFields: action.payload };
    case 'SET_FIELD_MAPPING':
      return { ...state, fieldMapping: action.payload };
    case 'SET_CUSTOM_VALUES':
      return { ...state, customValues: action.payload };
    case 'SET_EXCEL_HEADERS':
      return { ...state, excelHeaders: action.payload };
    case 'SET_SHEET_NAME':
      return { ...state, sheetName: action.payload };
    case 'SET_HEADER_ROW':
      return { ...state, headerRow: action.payload };
    case 'SET_AVAIL_SHEETS':
      return { ...state, availSheets: action.payload };
    case 'SET_PREVIEW_MODAL':
      return { ...state, previewModal: action.payload };
    case 'SET_BLANK_CELL_MODE':
      return { ...state, blankCellMode: action.payload };
    case 'SET_PREVIEW_META':
      return { ...state, previewMeta: action.payload };
    case 'SET_PERM_FIELDS':
      return {
        ...state,
        permUniqueFields: action.payload.unique,
        permRequiredFields: action.payload.required,
        permImportFields: action.payload.importFields,
      };
    case 'SET_AUTO_MATCH_FLAG':
      return { ...state, autoMatchFlag: action.payload };
    case 'SET_MATCH_INFO':
      return { ...state, matchInfo: action.payload };
    case 'RESET_FILE_STATE':
      return {
        ...state,
        uploadedFileId: null,
        uploadedFileName: '',
        excelHeaders: [],
        fieldMapping: {},
        previewData: null,
        customValues: {},
        availSheets: [],
      };
    default:
      return state;
  }
}
