using System;
using System.Collections.Generic;
using UnityEngine;

namespace LostCity.Core
{
    public class ResourceManager : MonoBehaviour
    {
        public static ResourceManager Instance { get; private set; }

        [SerializeField] private int _startingCrystals = 200;

        public int CrystalBalance { get; private set; }
        public event Action<int> OnCrystalsChanged;

        private readonly HashSet<Buildings.ElysianMine> _activeMines = new();

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
            CrystalBalance = _startingCrystals;
        }

        public bool TrySpend(int amount)
        {
            if (CrystalBalance < amount) return false;
            CrystalBalance -= amount;
            OnCrystalsChanged?.Invoke(CrystalBalance);
            EventBus.Publish(new ResourceChangedEvent { NewAmount = CrystalBalance });
            return true;
        }

        public void AddIncome(int amount)
        {
            CrystalBalance += amount;
            OnCrystalsChanged?.Invoke(CrystalBalance);
            EventBus.Publish(new ResourceChangedEvent { NewAmount = CrystalBalance });
        }

        public bool CanAfford(int amount) => CrystalBalance >= amount;

        public void RegisterMine(Buildings.ElysianMine mine) => _activeMines.Add(mine);
        public void UnregisterMine(Buildings.ElysianMine mine) => _activeMines.Remove(mine);
    }
}
