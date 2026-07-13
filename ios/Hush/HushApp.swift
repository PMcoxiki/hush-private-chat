import SwiftUI

@main
struct HushApp: App {
    var body: some Scene {
        WindowGroup {
            ChatWebView(url: URL(string: "https://hush-private-ai.coxiki.chatgpt.site/")!)
                .ignoresSafeArea(.container, edges: .bottom)
        }
    }
}
