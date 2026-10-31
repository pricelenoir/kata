template <int N> struct Explode { static const int value = Explode<N + 1>::value + 1; };
int main() { return Explode<0>::value; }
