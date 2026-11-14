const {withDangerousMod} = require('@expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// Only the update downloader is affected. TLS, Expo runtime/rollback selection
// and the native SHA-256 verification of every asset remain enabled.
const interceptor = `package expo.modules.updates.loader

import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import java.io.IOException
import java.security.MessageDigest

internal class UpdateMirrorInterceptor : Interceptor {
  private val website = "https://zanomerom.ru"
  private val raw = "https://raw.githubusercontent.com/leomaxx2012-cmd/zanomer/main/public"

  private fun mirrors(request: Request): List<String> {
    val url = request.url
    if (url.host == "u.expo.dev" && url.encodedPath == "/4f39246d-f506-4126-9019-4e1a4ebb1586") {
      val runtime = request.header("expo-runtime-version") ?: return emptyList()
      if (!runtime.matches(Regex("[a-zA-Z0-9._-]{1,100}"))) return emptyList()
      val suffix = "/mobile-updates/$runtime/manifest.json"
      return listOf(website + suffix, raw + suffix)
    }
    if (url.host == "assets.eascdn.net") {
      val key = MessageDigest.getInstance("SHA-256").digest((url.host + url.encodedPath).toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it.toInt() and 255) }
      val suffix = "/mobile-updates/assets/$key"
      return listOf(website + suffix, raw + suffix)
    }
    if (url.host == "zanomerom.ru" && url.encodedPath.startsWith("/mobile-updates/assets/")) {
      return listOf(raw + url.encodedPath)
    }
    return emptyList()
  }

  override fun intercept(chain: Interceptor.Chain): Response {
    val request = chain.request()
    val alternatives = mirrors(request)
    if (alternatives.isEmpty()) return chain.proceed(request)
    var failure: IOException? = null
    for ((index, target) in (listOf(request.url.toString()) + alternatives).withIndex()) {
      val attempt = if (index == 0) request else Request.Builder().url(target)
        .header("Accept", "application/json,application/octet-stream")
        .header("Cache-Control", "no-cache").build()
      try {
        val response = chain.proceed(attempt)
        if (!response.isSuccessful) {
          val code = response.code
          response.close()
          throw IOException("Update source returned HTTP $code")
        }
        response.use {
          val body = it.body ?: throw IOException("Empty update response")
          if (body.contentLength() > 20L * 1024 * 1024) throw IOException("Update file exceeds size limit")
          // Consume inside the retry boundary: an interrupted body download must
          // try the next source too, not just connection and response headers.
          val bytes = body.bytes()
          if (bytes.size > 20 * 1024 * 1024) throw IOException("Update file exceeds size limit")
          val rebuilt = it.newBuilder().body(bytes.toResponseBody(body.contentType()))
          if (index > 0 && request.url.host == "u.expo.dev") {
            rebuilt.header("expo-protocol-version", "1")
            rebuilt.header("content-type", "application/expo+json")
          }
          return rebuilt.build()
        }
      } catch (error: IOException) {
        failure = error
      }
    }
    throw failure ?: IOException("No update source available")
  }
}
`;

function patchDownloader(source) {
  if (source.includes('.addInterceptor(UpdateMirrorInterceptor())')) return source;
  const marker = '.addInterceptor(BrotliInterceptor)';
  if (!source.includes(marker)) throw Error('Expo downloader changed; review mirror integration before building');
  return source.replace(marker, marker + '\n    .callTimeout(90, TimeUnit.SECONDS)\n    .addInterceptor(UpdateMirrorInterceptor())');
}

module.exports = config => withDangerousMod(config, ['android', async mod => {
  const directory = path.join(path.dirname(require.resolve('expo-updates/package.json', {paths:[mod.modRequest.projectRoot]})), 'android/src/main/java/expo/modules/updates/loader');
  const file = path.join(directory, 'FileDownloader.kt');
  await fs.writeFile(file, patchDownloader(await fs.readFile(file, 'utf8')));
  await fs.writeFile(path.join(directory, 'UpdateMirrorInterceptor.kt'), interceptor);
  const tests=path.resolve(directory,'../../../../../../test/java/expo/modules/updates/loader');
  await fs.mkdir(tests,{recursive:true});
  await fs.copyFile(path.join(mod.modRequest.projectRoot,'plugins/UpdateMirrorInterceptorTest.kt'),path.join(tests,'UpdateMirrorInterceptorTest.kt'));
  return mod;
}]);
module.exports.patchDownloader = patchDownloader;
module.exports.interceptor = interceptor;
