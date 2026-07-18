import SwiftUI

enum AppConfiguration {
    static let webRootURL = Bundle.main.resourceURL!
        .appendingPathComponent("WebApp", isDirectory: true)
    static let indexURL = webRootURL.appendingPathComponent("index.html")
}

@main
struct HushApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var privacyCoverVisible = true
    @State private var lifecycleRevision = 0

    var body: some Scene {
        WindowGroup {
            ZStack {
                ChatWebView(
                    lifecycleRevision: lifecycleRevision,
                    isAppActive: scenePhase == .active,
                    onPrivacyReady: {
                        if scenePhase == .active { privacyCoverVisible = false }
                    }
                )
                .ignoresSafeArea(.container, edges: .bottom)

                if privacyCoverVisible {
                    PrivacyCoverView()
                        .transition(.opacity)
                        .zIndex(10)
                }
            }
            .onChange(of: scenePhase) { _ in
                privacyCoverVisible = true
                lifecycleRevision += 1
            }
        }
    }
}

private struct PrivacyCoverView: View {
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Image(systemName: "line.3.horizontal")
                Spacer()
                Text("ChatGPT").font(.system(size: 16, weight: .semibold))
                Spacer()
                Image(systemName: "square.and.pencil")
            }
            .font(.system(size: 20, weight: .regular))
            .padding(.horizontal, 20)
            .frame(height: 58)

            Spacer()

            VStack(spacing: 18) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14).fill(Color.black)
                    ForEach(0..<3, id: \.self) { index in
                        Capsule()
                            .stroke(Color.white, lineWidth: 2)
                            .frame(width: 27, height: 12)
                            .rotationEffect(.degrees(Double(index) * 60))
                    }
                }
                .frame(width: 45, height: 45)

                Text("有什么可以帮忙的？")
                    .font(.system(size: 26, weight: .semibold))
                    .tracking(-0.6)
            }
            .padding(.bottom, 70)

            Spacer()

            HStack(spacing: 12) {
                Image(systemName: "plus")
                Text("询问任何问题").foregroundStyle(.secondary)
                Spacer()
                Image(systemName: "waveform")
            }
            .font(.system(size: 16))
            .padding(.horizontal, 16)
            .frame(height: 54)
            .background(Color(.systemGray6))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Color(.separator), lineWidth: 0.5))
            .padding(.horizontal, 12)
            .padding(.bottom, 12)
        }
        .foregroundStyle(Color.primary)
        .background(Color(.systemBackground).ignoresSafeArea())
    }
}
