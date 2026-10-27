import { Stack } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import VercelAnalytics from "../lib/vercel-analytics";
import YandexMetrika from "../lib/yandex-metrika";
import { ResponsiveTypography } from "../components/ResponsiveText";
import { useFonts } from "expo-font";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ PlateNumber: require("../assets/fonts/PlateNumber.ttf") });
  if (!fontsLoaded && !fontError) return null;
  return (
    <>
      <Head>
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="ru" />
        <title>ЗаНомером</title>
      </Head>
      <VercelAnalytics />
      <YandexMetrika />
      <StatusBar style="dark" />
      <ResponsiveTypography><Stack screenOptions={{ headerShown: false }} /></ResponsiveTypography>
    </>
  );
}
