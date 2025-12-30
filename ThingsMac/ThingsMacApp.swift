import SwiftUI

@main
struct ThingsMacApp: App {
    @StateObject private var appState = AppState()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
        }
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("新增任務") {
                    appState.showQuickAdd = true
                }
                .keyboardShortcut("n", modifiers: [])
            }
        }
        
        Settings {
            SettingsView()
                .environmentObject(appState)
        }
    }
}
