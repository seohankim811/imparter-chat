using UnityEngine;
using LostCity.Data;

namespace LostCity.Units
{
    public class UnitFactory : MonoBehaviour
    {
        public static UnitFactory Instance { get; private set; }

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
        }

        public UnitBase Spawn(UnitData data, Vector3 position, Quaternion rotation)
        {
            if (data == null || data.Prefab == null)
            {
                Debug.LogError($"[UnitFactory] Missing data or prefab for unit: {data?.UnitName}");
                return null;
            }

            var go = Instantiate(data.Prefab, position, rotation);
            var unit = go.GetComponent<UnitBase>();
            if (unit == null)
            {
                Debug.LogError($"[UnitFactory] Prefab '{data.Prefab.name}' has no UnitBase component.");
                Destroy(go);
                return null;
            }

            unit.Initialize(data);
            Core.EventBus.Publish(new Core.UnitTrainedEvent { Unit = unit });
            return unit;
        }
    }
}
