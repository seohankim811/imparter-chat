using System.Collections;
using UnityEngine;
using LostCity.Core;

namespace LostCity.Buildings
{
    public class GuardianTower : BuildingBase
    {
        [SerializeField] private float _attackRange = 8f;
        [SerializeField] private float _attackDamage = 20f;
        [SerializeField] private float _attackCooldown = 1.5f;
        [SerializeField] private GameObject _projectilePrefab;
        [SerializeField] private LayerMask _enemyLayer;

        private IDamageable _currentTarget;

        protected override void Awake()
        {
            base.Awake();
            StartCoroutine(AutoAttackLoop());
        }

        private IEnumerator AutoAttackLoop()
        {
            while (!IsDestroyed)
            {
                FindTarget();
                if (_currentTarget != null)
                    FireAt(_currentTarget);
                yield return new WaitForSeconds(_attackCooldown);
            }
        }

        private void FindTarget()
        {
            var hits = Physics.OverlapSphere(transform.position, _attackRange, _enemyLayer);
            float closest = float.MaxValue;
            _currentTarget = null;
            foreach (var hit in hits)
            {
                var d = hit.GetComponent<IDamageable>();
                if (d == null || d.Faction != Faction.Neverseen) continue;
                float dist = Vector3.Distance(transform.position, hit.transform.position);
                if (dist < closest) { closest = dist; _currentTarget = d; }
            }
        }

        private void FireAt(IDamageable target)
        {
            var targetMono = target as MonoBehaviour;
            if (targetMono == null) return;

            if (_projectilePrefab != null)
            {
                var proj = Instantiate(_projectilePrefab, transform.position, Quaternion.identity);
                var tp = proj.GetComponent<Units.TelekineticProjectile>();
                tp?.Initialize(target, _attackDamage);
            }
            else
            {
                target.TakeDamage(_attackDamage);
            }
        }
    }
}
