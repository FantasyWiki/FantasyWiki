import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface League {
    id: string
    name: string
    icon: string
    season: string
}

//TODO: REMOVE AND ADD ACTUAL LOGIC
const available_leagues: League[] = [
    { id: 'global', name: 'Global', icon: '🌐', season: '2024' },
    { id: 'italy', name: 'Italia', icon: '🍕', season: '2024' },
]

/**
 * Store for managing current league context
 * Used across the app to track which league the user is viewing
 */
export const useLeagueStore = defineStore('league', () => {
    // ========== STATE ==========
    const currentLeague = ref<League>(
        // Try to restore from localStorage
        JSON.parse(<string>localStorage.getItem('currentLeague'))|| available_leagues[0]
    )

    const availableLeagues = ref<League[]>(available_leagues)
    const isLoading = ref(false)

    // ========== GETTERS ==========

    const currentLeagueName = computed(() => {
        return currentLeague.value.name || 'No League Selected'
    })

    // ========== ACTIONS ==========
    function setCurrentLeague(league: League) {
        currentLeague.value = league
        // Persist to localStorage
        localStorage.setItem('currentLeague', JSON.stringify(league))
    }

    function clearCurrentLeague() {
        localStorage.removeItem('currentLeague')
    }

    async function fetchLeagues() {
        isLoading.value = true
        try {
            // TODO: Replace with your actual API call
            const response = await fetch('/api/leagues')
            availableLeagues.value = await response.json()
        } catch (error) {
            console.error('Failed to fetch leagues:', error)
        } finally {
            isLoading.value = false
        }
    }

    return {
        // State
        currentLeague,
        availableLeagues,
        isLoading,
        // Getters
        currentLeagueName,
        // Actions
        setCurrentLeague,
        clearCurrentLeague,
        fetchLeagues
    }
})
