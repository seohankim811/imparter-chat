using System;
using UnityEngine;

namespace LostCity.Core
{
    public enum GameState { Playing, Paused, Victory, Defeat }
    public enum DefeatReason { CouncilHallDestroyed, SophieCaptured }

    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        public GameState CurrentState { get; private set; } = GameState.Playing;
        public event Action<GameState> OnGameStateChanged;
        public event Action<DefeatReason> OnDefeat;

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
        }

        private void OnEnable()
        {
            EventBus.Subscribe<NeverseenBaseDestroyedEvent>(OnNeverseenBaseDestroyed);
            EventBus.Subscribe<CouncilHallDestroyedEvent>(OnCouncilHallDestroyed);
            EventBus.Subscribe<SophieCapturedEvent>(OnSophieCaptured);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<NeverseenBaseDestroyedEvent>(OnNeverseenBaseDestroyed);
            EventBus.Unsubscribe<CouncilHallDestroyedEvent>(OnCouncilHallDestroyed);
            EventBus.Unsubscribe<SophieCapturedEvent>(OnSophieCaptured);
        }

        private void OnNeverseenBaseDestroyed(NeverseenBaseDestroyedEvent _) => TriggerVictory();
        private void OnCouncilHallDestroyed(CouncilHallDestroyedEvent _) => TriggerDefeat(DefeatReason.CouncilHallDestroyed);
        private void OnSophieCaptured(SophieCapturedEvent _) => TriggerDefeat(DefeatReason.SophieCaptured);

        public void TriggerVictory()
        {
            if (CurrentState != GameState.Playing) return;
            SetState(GameState.Victory);
        }

        public void TriggerDefeat(DefeatReason reason)
        {
            if (CurrentState != GameState.Playing) return;
            SetState(GameState.Defeat);
            OnDefeat?.Invoke(reason);
        }

        public void SetPaused(bool paused)
        {
            if (CurrentState == GameState.Victory || CurrentState == GameState.Defeat) return;
            SetState(paused ? GameState.Paused : GameState.Playing);
            Time.timeScale = paused ? 0f : 1f;
        }

        private void SetState(GameState state)
        {
            CurrentState = state;
            OnGameStateChanged?.Invoke(state);
        }
    }
}
