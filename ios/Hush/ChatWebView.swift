import SwiftUI
import WebKit

struct ChatWebView: UIViewRepresentable {
    let lifecycleRevision: Int
    let isAppActive: Bool

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        webView.loadFileURL(
            AppConfiguration.indexURL,
            allowingReadAccessTo: AppConfiguration.webRootURL
        )
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.lifecycleRevision != lifecycleRevision else { return }
        context.coordinator.lifecycleRevision = lifecycleRevision
        let eventName = isAppActive ? "app-active" : "app-inactive"
        webView.evaluateJavaScript(
            "document.dispatchEvent(new Event('\(eventName)'))"
        )
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var lifecycleRevision = -1

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            let rootPath = AppConfiguration.webRootURL.standardizedFileURL.path
            let requestedPath = url.standardizedFileURL.path
            if url.isFileURL && (requestedPath == rootPath || requestedPath.hasPrefix(rootPath + "/")) {
                decisionHandler(.allow)
            } else if url.absoluteString == "about:blank" {
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
            }
        }
    }
}
