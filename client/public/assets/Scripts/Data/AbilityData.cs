using UnityEngine;

namespace LostCity.Data
{
    [CreateAssetMenu(fileName = "AbilityData", menuName = "LostCity/Ability Data")]
    public class AbilityData : ScriptableObject
    {
        public string AbilityName;
        public Sprite Icon;
        public float Cooldown = 15f;
        public float Range = 10f;
        [TextArea] public string Description;
    }
}
