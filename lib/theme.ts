// Shared dark palette for web and Android. Plate artwork keeps its own colours.
export const darkTheme = {
  "onPrimary": "#FFFFFF",
  "background": "#151723",
  "surface": "#202332",
  "raised": "#292D40",
  "input": "#191C29",
  "border": "#41465E",
  "accentBorder": "#6E5D9C",
  "text": "#F4F3FA",
  "muted": "#B2B6C9",
  "accent": "#C4B5FD",
  "info": "#9ABFFF",
  "success": "#79DEB2",
  "warning": "#F8CB8C",
  "danger": "#FFADB5",
  "accentSurface": "#30284D",
  "infoSurface": "#202F49",
  "successSurface": "#193B30",
  "warningSurface": "#42331F",
  "dangerSurface": "#442631"
} as const;

export type Theme = { [K in keyof typeof darkTheme]: string };
export const lightTheme: Theme = {
 onPrimary:"#FFFFFF", background:"#F5F6FA",surface:"#FFFFFF",raised:"#EEF0F7",input:"#FFFFFF",border:"#D9DCE8",accentBorder:"#A79AE1",text:"#202532",muted:"#626B7E",accent:"#5143C2",info:"#175CD3",success:"#067647",warning:"#985016",danger:"#B42338",accentSurface:"#F0ECFF",infoSurface:"#EEF4FF",successSurface:"#E8F8F0",warningSurface:"#FFF5E8",dangerSurface:"#FFF1F3"
};
