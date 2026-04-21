using UnityEngine;

namespace LostCity.Data
{
    [CreateAssetMenu(fileName = "UnitData", menuName = "LostCity/Unit Data")]
    public class UnitData : ScriptableObject
    {
        [Header("Identity")]
        public string UnitName;
        public Sprite Portrait;
        public GameObject Prefab;
        public Core.Faction Faction;

        [Header("Stats")]
        public float MaxHealth = 100f;
        public float MoveSpeed = 3.5f;
        public float AttackRange = 2f;
        public float AttackDamage = 15f;
        public float AttackCooldown = 1.5f;

        [Header("Economy")]
        public int CrystalCost = 50;
        public float TrainingTime = 5f;

        [Header("Visuals")]
        public Color FactionColor = Color.white;
    }
}
