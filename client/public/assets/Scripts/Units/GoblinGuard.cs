namespace LostCity.Units
{
    public class GoblinGuard : UnitBase
    {
        private const float DamageReduction = 0.25f;

        public override void TakeDamage(float amount)
        {
            base.TakeDamage(amount * (1f - DamageReduction));
        }
    }
}
