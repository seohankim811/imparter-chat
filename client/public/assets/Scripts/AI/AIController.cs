using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using LostCity.Data;
using LostCity.Units;

namespace LostCity.AI
{
    public enum AIState { Expanding, Defending, Attacking }

    public class AIController : MonoBehaviour
    {
        [SerializeField] private Buildings.NeverseenBase _neverseenBase;
        [SerializeField] private AIResourceManager _resources;
        [SerializeField] private UnitData _agentData;
        [SerializeField] private UnitData _disguisedAgentData;
        [SerializeField] private int _waveSize = 4;
        [SerializeField] private float _tickInterval = 3f;

        private AIState _currentState = AIState.Expanding;
        private readonly List<AISquad> _activeSquads = new();
        private Transform _playerHQ;

        private void Start()
        {
            // Find player's CouncilHall as the attack target
            var hall = FindFirstObjectByType<Buildings.CouncilHall>();
            if (hall != null) _playerHQ = hall.transform;

            StartCoroutine(AITick());
        }

        private IEnumerator AITick()
        {
            while (true)
            {
                yield return new WaitForSeconds(_tickInterval);

                if (Core.GameManager.Instance?.CurrentState != Core.GameState.Playing) continue;
                if (_neverseenBase == null || _neverseenBase.IsDestroyed) yield break;

                EvaluateState();
                ExecuteState();
            }
        }

        private void EvaluateState()
        {
            float baseHealthPct = _neverseenBase.CurrentHealth / _neverseenBase.MaxHealth;
            int totalUnits = CountAllNeverseenUnits();

            if (baseHealthPct < 0.4f)
                _currentState = AIState.Defending;
            else if (totalUnits >= _waveSize)
                _currentState = AIState.Attacking;
            else
                _currentState = AIState.Expanding;
        }

        private void ExecuteState()
        {
            switch (_currentState)
            {
                case AIState.Expanding:
                    TrySpawnUnit();
                    break;
                case AIState.Defending:
                    TrySpawnUnit();
                    // Call units back to base
                    foreach (var sq in _activeSquads)
                        sq.AssignObjective(_neverseenBase.transform);
                    break;
                case AIState.Attacking:
                    SpawnWave();
                    break;
            }
        }

        private void TrySpawnUnit()
        {
            if (_agentData == null || _neverseenBase == null) return;
            if (!_resources.CanAfford(_agentData.CrystalCost)) return;

            _resources.TrySpend(_agentData.CrystalCost);
            var spawnPoint = _neverseenBase.GetSpawnPoint();

            // Occasionally spawn disguised agents
            bool spawnDisguised = _disguisedAgentData != null && Random.value < 0.2f * _resources.Difficulty;
            var data = spawnDisguised ? _disguisedAgentData : _agentData;
            UnitFactory.Instance?.Spawn(data, spawnPoint.position, Quaternion.identity);
        }

        private void SpawnWave()
        {
            if (_playerHQ == null || _neverseenBase == null) return;

            var waveUnits = new List<UnitBase>();
            for (int i = 0; i < _waveSize; i++)
            {
                if (!_resources.TrySpend(_agentData?.CrystalCost ?? 50)) break;
                var spawnPoint = _neverseenBase.GetSpawnPoint();
                var unit = UnitFactory.Instance?.Spawn(_agentData, spawnPoint.position, Quaternion.identity);
                if (unit != null) waveUnits.Add(unit);
            }

            if (waveUnits.Count == 0) return;

            var squad = new GameObject("AISquad").AddComponent<AISquad>();
            squad.Initialize(waveUnits, _playerHQ);
            squad.OnSquadDestroyed += OnSquadDestroyed;
            _activeSquads.Add(squad);
        }

        private void OnSquadDestroyed(AISquad squad)
        {
            _activeSquads.Remove(squad);
        }

        private int CountAllNeverseenUnits()
        {
            int count = 0;
            foreach (var u in FindObjectsByType<UnitBase>(FindObjectsSortMode.None))
                if (u.Faction == Core.Faction.Neverseen) count++;
            return count;
        }
    }
}
