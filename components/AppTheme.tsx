import {createContext,useContext,useEffect,useMemo,useRef,useState,type PropsWithChildren} from 'react';
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {darkTheme,lightTheme,type Theme} from '../lib/theme';
type Mode='light'|'dark';
const storageKey='zanomer.appearance.v1';
const ThemeContext=createContext({theme:darkTheme as Theme,mode:'dark' as Mode,toggleTheme:()=>{}});
export function ThemeProvider({children}:PropsWithChildren){
 const [mode,setMode]=useState<Mode>('dark');
 const changed=useRef(false);
 useEffect(()=>{let active=true;void AsyncStorage.getItem(storageKey).then(saved=>{if(active&&!changed.current&&(saved==='light'||saved==='dark'))setMode(saved);}).catch(()=>{});return()=>{active=false;};},[]);
 const value=useMemo(()=>({mode,theme:mode==='dark'?darkTheme:lightTheme,toggleTheme:()=>{changed.current=true;const next=mode==='dark'?'light':'dark';setMode(next);void AsyncStorage.setItem(storageKey,next).catch(()=>{});}}),[mode]);
 useEffect(()=>{if(Platform.OS!=='web')return;document.documentElement.style.colorScheme=mode;document.body.style.backgroundColor=value.theme.background;document.documentElement.style.setProperty('--page-background',value.theme.background);document.documentElement.style.setProperty('--page-text',value.theme.text);document.documentElement.style.setProperty('--page-link',value.theme.accent);document.documentElement.style.setProperty('--page-muted',value.theme.muted);document.querySelector('meta[name="theme-color"]')?.setAttribute('content',value.theme.background);},[mode,value.theme]);
 return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export const useTheme=()=>useContext(ThemeContext);
export function useThemedStyles<T>(create:(theme:Theme)=>T):T {const {theme}=useTheme();return useMemo(()=>create(theme),[create,theme]);}
