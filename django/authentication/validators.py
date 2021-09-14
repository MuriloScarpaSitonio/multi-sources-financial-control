def validate_cpf(value):
    def get_cpf_sum(value, _range):
        _sum = 0
        for char, i in zip(value, _range):
            _sum += int(char) * i
        return _sum

    if len(value) != 11:
        return False

    if len(set(value)) == 1:
        return False

    first_digit_sum = get_cpf_sum(value, range(10, 1, -1))
    if int(value[-2]) != (first_digit_sum * 10) % 11:
        return False

    second_digit_sum = get_cpf_sum(value, range(11, 1, -1))
    if int(value[-1]) != (second_digit_sum * 10) % 11:
        return False

    return True
