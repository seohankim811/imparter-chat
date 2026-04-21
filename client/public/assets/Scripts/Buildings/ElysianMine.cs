using System.Collections;
using UnityEngine;

namespace LostCity.Buildings
{
    public class ElysianMine : BuildingBase
    {
        [SerializeField] private int _crystalsPerTick = 10;
        [SerializeField] private float _tickInterval = 5f;

        protected override void Awake()
        {
            base.Awake();
            Core.ResourceManager.Instance?.RegisterMine(this);
            StartCoroutine(ProduceResources());
        }

        private IEnumerator ProduceResources()
        {
            while (!IsDestroyed)
            {
                yield return new WaitForSeconds(_tickInterval);
                if (!IsDestroyed)
                    Core.ResourceManager.Instance?.AddIncome(_crystalsPerTick);
            }
        }

        protected override void OnDestroyed()
        {
            Core.ResourceManager.Instance?.UnregisterMine(this);
            base.OnDestroyed();
        }
    }
}
