import {ThemeProvider,useTheme} from "../components/AppTheme";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import VercelAnalytics from "../lib/vercel-analytics";
import YandexMetrika from "../lib/yandex-metrika";
import { ResponsiveTypography } from "../components/ResponsiveText";
import { ActionMotion } from "../components/ActionMotion";

export default function RootLayout(){return <ThemeProvider><AppLayout /></ThemeProvider>;}
function AppLayout() {
 const {theme,mode}=useTheme();
  return (
    <>
      <Head>
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="ru" />
        <title>Красивые номера на авто, мото и прицепы — ЗаНомером</title>
      </Head>
      <VercelAnalytics />
      <ActionMotion />
      <YandexMetrika />
      <StatusBar style={mode === "dark" ? "light" : "dark"} backgroundColor={theme.background} />
      <ResponsiveTypography><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }} /></ResponsiveTypography>
    </>
  );
}
