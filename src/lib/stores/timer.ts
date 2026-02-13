import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'smartoffice:timer';

interface TimerState {
	isRunning: boolean;
	taskId: number | null;
	taskName: string;
	startTime: number | null; // unix timestamp ms
}

const defaultState: TimerState = {
	isRunning: false,
	taskId: null,
	taskName: '',
	startTime: null
};

function loadFromStorage(): TimerState {
	if (!browser) return defaultState;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return defaultState;
		const parsed = JSON.parse(raw) as TimerState;
		if (parsed.isRunning && parsed.startTime && parsed.taskId) {
			return parsed;
		}
		return defaultState;
	} catch {
		return defaultState;
	}
}

function saveToStorage(state: TimerState) {
	if (!browser) return;
	if (state.isRunning) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} else {
		localStorage.removeItem(STORAGE_KEY);
	}
}

function createTimerStore() {
	const { subscribe, set, update } = writable<TimerState>(loadFromStorage());

	return {
		subscribe,

		start(taskId: number, taskName: string) {
			const state: TimerState = {
				isRunning: true,
				taskId,
				taskName,
				startTime: Date.now()
			};
			set(state);
			saveToStorage(state);
		},

		stop(): { taskId: number; taskName: string; elapsedMinutes: number } | null {
			const current = get({ subscribe });
			if (!current.isRunning || !current.startTime || !current.taskId) {
				return null;
			}
			const elapsedMs = Date.now() - current.startTime;
			const elapsedMinutes = Math.max(1, Math.ceil(elapsedMs / 60000));
			const result = {
				taskId: current.taskId,
				taskName: current.taskName,
				elapsedMinutes
			};
			set(defaultState);
			saveToStorage(defaultState);
			return result;
		},

		reset() {
			set(defaultState);
			saveToStorage(defaultState);
		},

		getElapsedSeconds(): number {
			const current = get({ subscribe });
			if (!current.isRunning || !current.startTime) return 0;
			return Math.floor((Date.now() - current.startTime) / 1000);
		},

		isTimerRunning(taskId: number): boolean {
			const current = get({ subscribe });
			return current.isRunning && current.taskId === taskId;
		}
	};
}

export const timer = createTimerStore();
