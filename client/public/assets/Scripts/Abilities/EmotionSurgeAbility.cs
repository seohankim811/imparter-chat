using UnityEngine;

namespace LostCity.Abilities
{
    public class EmotionSurgeAbility : AbilityBase
    {
        [SerializeField] private float _effectRadius = 8f;
        [SerializeField] private float _debuffDuration = 5f;
        [SerializeField] private float _damageReduction = 0.4f;
        [SerializeField] private float _speedReduction = 0.5f;
        [SerializeField] private LayerMask _unitLayer;

        protected override void Activate(Vector3 targetPoint)
        {
            var hits = Physics.OverlapSphere(targetPoint, _effectRadius, _unitLayer);
            foreach (var hit in hits)
            {
                var debuffable = hit.GetComponent<Core.IDebuffable>();
                if (debuffable != null)
                {
                    var unit = hit.GetComponent<Units.UnitBase>();
                    if (unit != null && unit.Faction == Core.Faction.Neverseen)
                        debuffable.ApplyDebuff(_damageReduction, _speedReduction, _debuffDuration);
                }
            }
        }
    }
}
