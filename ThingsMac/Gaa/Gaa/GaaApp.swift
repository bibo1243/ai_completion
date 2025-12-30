//
//  GaaApp.swift
//  Gaa
//
//  Created by Lee Gary on 2025/12/31.
//

import SwiftUI

@main
struct GaaApp: App {
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
