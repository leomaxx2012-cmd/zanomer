package expo.modules.updates.loader

import io.mockk.every
import io.mockk.mockk
import okhttp3.Interceptor
import okhttp3.MediaType
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer
import okio.BufferedSource
import okio.Source
import okio.Timeout
import okio.buffer
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class UpdateMirrorInterceptorTest {
  private val primary = "https://u.expo.dev/4f39246d-f506-4126-9019-4e1a4ebb1586"
  private fun request(url: String = primary) = Request.Builder().url(url)
    .header("expo-runtime-version", "1.0.27").header("Authorization", "do-not-forward")
    .header("Cookie", "do-not-forward").build()
  private fun response(request: Request, code: Int = 200, body: ResponseBody = "{}".toResponseBody()) =
    Response.Builder().request(request).protocol(Protocol.HTTP_1_1).code(code).message("test").body(body).build()

  @Test fun connectionFailureUsesMirrorWithoutForwardingIdentifiersOrCredentials() {
    val chain=mockk<Interceptor.Chain>()
    val calls=mutableListOf<Request>()
    every {chain.request()} returns request()
    every {chain.proceed(any())} answers {
      val next=firstArg<Request>(); calls.add(next)
      if(calls.size==1)throw IOException("unreachable")
      response(next)
    }
    UpdateMirrorInterceptor().intercept(chain).use {
      assertEquals("1",it.header("expo-protocol-version"))
      assertEquals("{}",it.body!!.string())
    }
    assertEquals(2,calls.size)
    assertEquals("https://zanomerom.ru/mobile-updates/1.0.27/manifest.json",calls[1].url.toString())
    assertNull(calls[1].header("Authorization")); assertNull(calls[1].header("Cookie"))
  }

  @Test fun blockedWebsiteUsesIndependentGithubOrigin() {
    val chain=mockk<Interceptor.Chain>(); val calls=mutableListOf<Request>()
    every {chain.request()} returns request()
    every {chain.proceed(any())} answers {
      val next=firstArg<Request>(); calls.add(next); response(next,if(calls.size<3)403 else 200)
    }
    UpdateMirrorInterceptor().intercept(chain).close()
    assertEquals(3,calls.size)
    assertEquals("raw.githubusercontent.com",calls[2].url.host)
  }

  @Test fun interruptedSuccessfulResponseBodyAlsoRetries() {
    val chain=mockk<Interceptor.Chain>(); var attempts=0
    val broken=object:ResponseBody(){
      override fun contentType():MediaType?=null
      override fun contentLength():Long=10
      override fun source():BufferedSource=object:Source {
        override fun read(sink:Buffer,byteCount:Long):Long=throw IOException("connection reset")
        override fun timeout()=Timeout.NONE
        override fun close(){}
      }.buffer()
    }
    every {chain.request()} returns request()
    every {chain.proceed(any())} answers {attempts++;response(firstArg(),body=if(attempts==1)broken else "complete".toResponseBody())}
    UpdateMirrorInterceptor().intercept(chain).use {assertEquals("complete",it.body!!.string())}
    assertEquals(2,attempts)
  }

  @Test fun allSourcesOfflineReturnsFailureWithoutAnEndlessLoop() {
    val chain=mockk<Interceptor.Chain>(); var attempts=0
    every {chain.request()} returns request()
    every {chain.proceed(any())} answers {attempts++;throw IOException("offline")}
    assertThrows(IOException::class.java){UpdateMirrorInterceptor().intercept(chain)}
    assertEquals(3,attempts)
  }

  @Test fun unrelatedRequestsNeverUseMirrors() {
    val chain=mockk<Interceptor.Chain>(); var attempts=0
    every {chain.request()} returns request("https://example.com/private")
    every {chain.proceed(any())} answers {attempts++;throw IOException("offline")}
    assertThrows(IOException::class.java){UpdateMirrorInterceptor().intercept(chain)}
    assertEquals(1,attempts)
  }
}
