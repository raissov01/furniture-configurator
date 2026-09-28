package kz.aismebel.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

/**
 * Гибрид қобық (docs/mobile/hybrid.md). «Артқа» батырмасы:
 * 1) беттің өз ілмегі window.aismebelBack() (мысалы, өлшеу шеберінен тізімге);
 * 2) WebView тарихы; 3) офлайн бетте не тарих бос болса — қосымшадан шығу.
 * Офлайн беттен тарихпен артқа жүрмейміз: алдыңғы жазба — жүктелмеген сервер беті,
 * ол қайта errorPath-қа әкеліп, пайдаланушы шыға алмай қалар еді.
 */
public class MainActivity extends BridgeActivity {
    private static final String OFFLINE_PAGE = "aismebel-offline.html";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() == null ? null : getBridge().getWebView();
                if (webView == null) {
                    exit();
                    return;
                }
                webView.evaluateJavascript(
                    "(function(){try{return !!(window.aismebelBack&&window.aismebelBack())}catch(e){return false}})()",
                    handled -> {
                        if ("true".equals(handled)) return;
                        String url = webView.getUrl();
                        boolean offline = url != null && url.contains(OFFLINE_PAGE);
                        if (!offline && webView.canGoBack()) webView.goBack();
                        else exit();
                    }
                );
            }

            private void exit() {
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }
}
