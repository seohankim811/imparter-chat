using System.Collections;
using UnityEngine;

namespace LostCity.AI
{
    public class AIResourceManager : MonoBehaviour
    {
        [SerializeField] private int _startingCrystals = 150;
        [SerializeField] private int _incomePerTick = 15;
        [SerializeField] private float _tickInterval = 6f;
        [SerializeField] [Range(0f, 1f)] private float _difficulty = 0.5f;

        public int Crystals { get; private set; }
        public float Difficulty => _difficulty;

        private void Awake()
        {
            Crystals = _startingCrystals;
        }

        private void Start()
        {
            StartCoroutine(PassiveIncome());
        }

        private IEnumerator PassiveIncome()
        {
            while (true)
            {
                yield return new WaitForSeconds(_tickInterval / (1f + _difficulty));
                Crystals += Mathf.RoundToInt(_incomePerTick * (1f + _difficulty));
            }
        }

        public bool TrySpend(int amount)
        {
            if (Crystals < amount) return false;
            Crystals -= amount;
            return true;
        }

        public bool CanAfford(int amount) => Crystals >= amount;
    }
}
