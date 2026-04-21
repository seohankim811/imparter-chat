using UnityEngine;

namespace LostCity.Data
{
    [CreateAssetMenu(fileName = "BuildingData", menuName = "LostCity/Building Data")]
    public class BuildingData : ScriptableObject
    {
        [Header("Identity")]
        public string BuildingName;
        public Sprite Icon;
        public GameObject Prefab;
        public Core.Faction Faction;

        [Header("Stats")]
        public float MaxHealth = 500f;

        [Header("Economy")]
        public int CrystalCost = 100;
        public float BuildTime = 10f;
    }
}
