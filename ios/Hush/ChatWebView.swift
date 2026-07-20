import SwiftUI
import WebKit

struct ChatWebView: UIViewRepresentable {
    let lifecycleRevision: Int
    let isAppActive: Bool
    let onPrivacyReady: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onPrivacyReady: onPrivacyReady) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.setURLSchemeHandler(context.coordinator, forURLScheme: "hush")
        configuration.userContentController.add(context.coordinator, name: "privacyReady")
        configuration.userContentController.add(context.coordinator, name: "privateNotifications")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 33.0 / 255.0, green: 33.0 / 255.0, blue: 33.0 / 255.0, alpha: 1)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        webView.load(URLRequest(url: AppConfiguration.appURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.updateLifecycle(
            revision: lifecycleRevision,
            isAppActive: isAppActive,
            webView: webView,
            onPrivacyReady: onPrivacyReady
        )
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "privacyReady")
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "privateNotifications")
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, WKURLSchemeHandler {
        var lifecycleRevision = -1
        var onPrivacyReady: () -> Void
        private var isAppActive = false
        private var readinessGeneration = 0

        private static let readinessScript = """
        (() => {
          const shell = document.querySelector('main.app-shell');
          const composer = document.querySelector('main.app-shell .composer textarea');
          const privateLocked = document.documentElement.dataset.privateLocked === 'true';
          return Boolean(shell && composer && !privateLocked);
        })()
        """

        init(onPrivacyReady: @escaping () -> Void) {
            self.onPrivacyReady = onPrivacyReady
        }

        func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
            guard let url = urlSchemeTask.request.url,
                  url.scheme == "hush",
                  url.host == "app" else {
                fail(urlSchemeTask, code: .unsupportedURL)
                return
            }

            let relativePath = (url.path.removingPercentEncoding ?? url.path)
                .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            let requestedURL = AppConfiguration.webRootURL
                .appendingPathComponent(relativePath.isEmpty ? "index.html" : relativePath)
                .standardizedFileURL
            let rootPath = AppConfiguration.webRootURL.standardizedFileURL.path
            let requestedPath = requestedURL.path

            guard requestedPath.hasPrefix(rootPath + "/"),
                  let data = try? Data(contentsOf: requestedURL) else {
                fail(urlSchemeTask, code: .fileDoesNotExist)
                return
            }

            let response = URLResponse(
                url: url,
                mimeType: Self.mimeType(for: requestedURL.pathExtension),
                expectedContentLength: data.count,
                textEncodingName: Self.isTextExtension(requestedURL.pathExtension) ? "utf-8" : nil
            )
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        }

        func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

        private func fail(_ task: WKURLSchemeTask, code: URLError.Code) {
            task.didFailWithError(URLError(code))
        }

        private static func isTextExtension(_ pathExtension: String) -> Bool {
            ["html", "js", "css", "json", "webmanifest", "svg"].contains(pathExtension.lowercased())
        }

        private static func mimeType(for pathExtension: String) -> String {
            switch pathExtension.lowercased() {
            case "html": "text/html"
            case "js": "text/javascript"
            case "css": "text/css"
            case "json": "application/json"
            case "webmanifest": "application/manifest+json"
            case "svg": "image/svg+xml"
            case "png": "image/png"
            case "jpg", "jpeg": "image/jpeg"
            case "webp": "image/webp"
            case "ico": "image/x-icon"
            default: "application/octet-stream"
            }
        }

        func updateLifecycle(
            revision: Int,
            isAppActive: Bool,
            webView: WKWebView,
            onPrivacyReady: @escaping () -> Void
        ) {
            self.onPrivacyReady = onPrivacyReady
            self.isAppActive = isAppActive
            guard lifecycleRevision != revision else { return }

            lifecycleRevision = revision
            readinessGeneration += 1
            let eventName = isAppActive ? "app-active" : "app-inactive"
            webView.evaluateJavaScript("document.dispatchEvent(new Event('\(eventName)'))")

            if isAppActive {
                beginCoverReadinessCheck(in: webView)
            }
        }

        private func beginCoverReadinessCheck(in webView: WKWebView) {
            guard isAppActive else { return }
            readinessGeneration += 1
            let generation = readinessGeneration
            checkCoverReadiness(in: webView, generation: generation, attempt: 0)
        }

        private func checkCoverReadiness(
            in webView: WKWebView,
            generation: Int,
            attempt: Int
        ) {
            guard isAppActive, generation == readinessGeneration else { return }

            webView.evaluateJavaScript(Self.readinessScript) { [weak self, weak webView] result, _ in
                DispatchQueue.main.async {
                    guard let self,
                          let webView,
                          self.isAppActive,
                          generation == self.readinessGeneration else { return }

                    if result as? Bool == true {
                        self.readinessGeneration += 1
                        self.onPrivacyReady()
                        return
                    }

                    guard attempt < 50 else { return }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self, weak webView] in
                        guard let self, let webView else { return }
                        self.checkCoverReadiness(
                            in: webView,
                            generation: generation,
                            attempt: attempt + 1
                        )
                    }
                }
            }
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            if message.name == "privacyReady", message.body as? String == "cover-ready" {
                DispatchQueue.main.async {
                    guard self.isAppActive else { return }
                    self.readinessGeneration += 1
                    self.onPrivacyReady()
                }
                return
            }

            guard message.name == "privateNotifications",
                  let payload = message.body as? [String: Any],
                  let type = payload["type"] as? String else { return }
            DispatchQueue.main.async {
                switch type {
                case "prepare":
                    PrivateMessageNotificationManager.shared.prepare()
                case "incoming":
                    guard let id = payload["id"] as? String else { return }
                    PrivateMessageNotificationManager.shared.notifyIncomingMessage(id: id)
                default:
                    return
                }
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard isAppActive else { return }
            webView.evaluateJavaScript("document.dispatchEvent(new Event('app-active'))")
            beginCoverReadinessCheck(in: webView)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            if url.scheme == "hush" && url.host == "app" {
                decisionHandler(.allow)
            } else if url.absoluteString == "about:blank" {
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
            }
        }
    }
}
