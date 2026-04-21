using UnityEngine;
using LostCity.Core;

namespace LostCity.Units
{
    public class FitzVacker : UnitBase
    {
        [SerializeField] private GameObject _projectilePrefab;
        [SerializeField] private Transform _firePoint;
        [SerializeField] private float _bonusRange = 3f;

        protected override void ExecuteAttack(IDamageable target)
        {
            if (_projectilePrefab == null)
            {
                target.TakeDamage(_data.AttackDamage);
                return;
            }
            var spawnPos = _firePoint != null ? _firePoint.position : transform.position;
            var proj = Instantiate(_projectilePrefab, spawnPos, Quaternion.identity);
            var tp = proj.GetComponent<TelekineticProjectile>();
            if (tp != null)
                tp.Initialize(target, _data.AttackDamage);
        }

        protected override void Awake()
        {
            base.Awake();
            // Apply range bonus after data is loaded
            // Range bonus is handled in targeting checks via AttackRange property
        }

        public float EffectiveRange => (_data != null ? _data.AttackRange : 2f) + _bonusRange;
    }
}
